const express = require("express");
const app = express();
const { Datastore } = require("@google-cloud/datastore");
const { Storage } = require("@google-cloud/storage");
const cors = require("cors");
const crypto = require("crypto");
const bodyParser = require("body-parser");

app.use(cors());
app.use(
  bodyParser.json({
    extended: true,
    limit: "50mb",
  })
);

const datastore = new Datastore();
const storage = new Storage();

const bucket = storage.bucket("my_maps_avatar_bucket");

async function retrieveTimeline(userId) {
  const ancestoreKey = datastore.key(["user", userId]);
  const query = datastore.createQuery("timeline").hasAncestor(ancestoreKey);
  const saved = await datastore.runQuery(query);
  console.log("TL recup:", saved);
  return saved[0];
}

async function addTimeline(timeline) {
  const timelineKey = datastore.key(["user", timeline.userId, "timeline"]);
  const timelineEntity = {
    origin: timeline.origin,
    destination: timeline.destination,
    time: timeline.time,
    sub: false,
  };
  const entity = {
    key: timelineKey,
    data: timelineEntity,
  };
  await datastore.insert(entity);
}

async function retrieveUser(email, password) {
  const passwdHash = crypto.createHash("sha256").update(password).digest("hex");
  const query = datastore
    .createQuery("user")
    .filter("email", "=", email)
    .filter("password", "=", passwdHash);
  const users = await datastore.runQuery(query);
  return users[0][0];
}

async function editUser(user) {
  const userKey = datastore.key(["user", datastore.int(user.id)]);
  user.password = crypto
    .createHash("sha256")
    .update(user.password)
    .digest("hex");
  const DSuser = {
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    password: user.password,
  };
  const entity = {
    key: userKey,
    data: DSuser,
  };
  await datastore.update(entity);
}

async function createUser(user) {
  const userKey = datastore.key("user");
  user.password = crypto
    .createHash("sha256")
    .update(user.password)
    .digest("hex");
  const entity = {
    key: userKey,
    data: user,
  };
  await datastore.insert(entity);
}

function isValidHttpUrl(string) {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}

app.get("/", (req, res) => {
  res.status(200);
  res.send("Hello from My Maps API!");
});

app.get("/login", (req, res) => {
  const email = req.query.email;
  const password = req.query.password;
  retrieveUser(email, password).then((user) => {
    if (user != null) {
      const userData = {
        avatar: user.avatar,
        username: user.username,
        email: user.email,
        id: user[Datastore.KEY].id,
      };
      res.status(200);
      res.json(userData);
    } else {
      res.status(401);
      res.send("User not found !");
    }
  });
});

app.post("/signup", (req, res) => {
  let avatar = "";

  if (req.body.avatar != null) {
    const file = bucket.file(req.body.username + "-avatar.jpg");
    const tmp = Buffer.from(
      req.body.avatar.replace(/^data:image\/(png|gif|jpeg);base64,/, ""),
      "base64"
    );
    file.save(tmp, function (err) {
      if (!err) {
        // File written successfully.
        avatar = file.publicUrl();

        const user = { ...req.body, avatar };
        createUser(user).then(
          () => {
            res.status(200);
            res.send("Success");
          },
          (resp) => {
            console.log(resp);
            res.status(500);
            res.send("Failure");
          }
        );
      }
    });
  } else {
    const user = { ...req.body, avatar };
    createUser(user).then(
      () => {
        res.status(200);
        res.send("Success");
      },
      (resp) => {
        console.log(resp);
        res.status(500);
        res.send("Failure");
      }
    );
  }
});

app.post("/editProfil", (req, res) => {
  let avatar = "";

  if (req.body.avatar != null && !isValidHttpUrl(req.body.avatar)) {
    const file = bucket.file(req.body.username + "-avatar.jpg");
    const tmp = Buffer.from(
      req.body.avatar.replace(/^data:image\/(png|gif|jpeg);base64,/, ""),
      "base64"
    );
    file.save(tmp, function (err) {
      if (!err) {
        // File written successfully.
        avatar = file.publicUrl();

        const user = { ...req.body, avatar };
        editUser(user).then(
          () => {
            res.status(200);
            res.send("Success");
          },
          (resp) => {
            console.log(resp);
            res.status(500);
            res.send("Failure");
          }
        );
      }
    });
  } else if (isValidHttpUrl(req.body.avatar)) {
    const user = { ...req.body };
    editUser(user).then(
      () => {
        res.status(200);
        res.send("Success");
      },
      (resp) => {
        console.log(resp);
        res.status(500);
        res.send("Failure");
      }
    );
  } else {
    const user = { ...req.body, avatar };
    editUser(user).then(
      () => {
        res.status(200);
        res.send("Success");
      },
      (resp) => {
        console.log(resp);
        res.status(500);
        res.send("Failure");
      }
    );
  }
});

app.get("/getTimelines", (req, res) => {
  const userId = req.query.userId;
  retrieveTimeline(userId).then((timelines) => {
    if (timelines != null) {
      const dataTL = timelines.map((tl) => {
        const timeline = {
          time: tl.time,
          sub: tl.sub,
          destination: tl.destination,
          origin: tl.origin,
          id: tl[Datastore.KEY].id,
        };
        return timeline;
      });
      res.status(200);
      res.json(dataTL);
    } else {
      res.status(401);
      res.send("Timelines not found !");
    }
  });
});

app.post("/addTimeline", (req, res) => {
  addTimeline(req.body).then(
    () => {
      res.status(200);
      res.send("Success");
    },
    () => {
      res.status(500);
      res.send("Failure");
    }
  );
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
