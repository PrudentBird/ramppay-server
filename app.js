const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const UserModel = require("./config/database");
const { hashSync } = require("bcrypt");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { MongoClient } = require("mongodb");
const cookieParser = require("cookie-parser");

const expirationDate = new Date(Date.now() + 3600000);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    secret: process.env.key,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: `mongodb+srv://danielwari:${process.env.key}@ramppay.jmcq7vl.mongodb.net/ramppay-session`,
      ttl: 60 * 60,
    }),
    cookie: { expires: expirationDate },
  })
);

app.use(
  cors({
    credentials: true,
    origin: "http://localhost:3000",
  })
);

app.use(passport.initialize());
app.use(passport.session());

const mongoUrl = `mongodb+srv://danielwari:${process.env.key}@ramppay.jmcq7vl.mongodb.net/ramppay-session`;
const client = new MongoClient(mongoUrl);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong!");
});

require("./config/passport");

app.get("/", (req, res) => {
  res.send("Welcome to RampPay");
});

app.post("/register", (req, res) => {
  const user = new UserModel({
    fullname: req.body.fullname,
    username: req.body.username,
    password: hashSync(req.body.password, 10),
  });

  user
    .save()
    .then((user) => {
      res.send({
        success: true,
        message: "User created successfully!",
        data: {
          user: {
            id: user._id,
            username: user.username,
          },
        },
      });
    })
    .catch((error) => {
      if (error.code === 11000) {
        res.send({
          error: true,
          message: "Username is already taken!",
        });
      } else {
        res.send({
          error: true,
          message: "Something went wrong, please try again!",
        });
      }
    });
});

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return res.send({
        error: true,
        message: "Internal server error",
      });
    }

    if (!user) {
      return res.send({
        error: true,
        message: "Incorrect user information",
      });
    }

    req.logIn(user, async () => {
      let token = user.usertoken;

      try {
        jwt.verify(token, Buffer.from(process.env.key, "base64"));
      } catch (error) {
        const payload = { username: user.username };

        token = jwt.sign(payload, Buffer.from(process.env.key, "base64"), {
          expiresIn: "1d",
        });
        user.usertoken = token;

        try {
          await user.save();

          res.cookie("sessionId", req.sessionID, {
            httpOnly: false,
            secure: true,
            expires: expirationDate,
            sameSite: "none",
          });

          return res.send({
            success: true,
            message: "Logged in successfully!",
            token: token,
          });
        } catch (error) {
          return res.send({
            error: true,
            message: "Internal server error",
          });
        }
      }

      res.cookie("sessionId", req.sessionID, {
        httpOnly: false,
        secure: true,
        expires: expirationDate,
        sameSite: "none",
      });

      return res.send({
        success: true,
        message: "Logged in successfully!",
        token: token,
      });
    });
  })(req, res, next);
});

app.use(
  "/protected",
  (() => {
    const protectedRouter = express.Router();

    protectedRouter.use(async (req, res, next) => {
      try {
        const sessionIdFromCookie = req.cookies.sessionId;

        await client.connect();

        const database = client.db("ramppay-session");
        const sessionsCollection = database.collection("sessions");
        await sessionsCollection.findOne({
          _id: sessionIdFromCookie,
        });

        const sessionDataFromSessionStore = await new Promise(
          (resolve, reject) => {
            req.sessionStore.get(sessionIdFromCookie, (error, sessionData) => {
              if (error) {
                console.error("Error retrieving session:", error);
                return reject(error);
              }

              if (!sessionData) {
                console.error("Session not found in store");
                return reject("Session not found");
              }
              resolve(sessionData);
            });
          }
        );

        if (
          !sessionDataFromSessionStore ||
          req.user.id !== sessionDataFromSessionStore.passport.user
        ) {
          return res.status(401).json({
            error: true,
            message: "Invalid session ID. Authentication failed.",
          });
        }

        passport.authenticate("jwt", (err, user, info, status) => {
          if (err) {
            console.error("Passport authentication error:", err);
            return next(err);
          }
          if (!user) {
            console.error("Passport authentication failed:", info);
            return res.status(401).json({
              error: true,
              message: "Authentication failed",
            });
          }

          res.status(200).json({
            success: true,
            data: {
              user: {
                fullname: user.fullname,
                username: user.username,
              },
            },
          });
        })(req, res, next);
      } catch (error) {
        console.error("Unhandled error:", error);
        return res.status(500).json({
          error: true,
          message: "Internal server error",
        });
      } finally {
        await client.close();
      }
    });
    return protectedRouter;
  })()
);

app.post("/logout", async (req, res) => {
  try {
    const sessionIdFromCookie = req.cookies.sessionId;

    await client.connect();

    const database = client.db("ramppay-session");
    const sessionsCollection = database.collection("sessions");

    await sessionsCollection.deleteOne({ _id: sessionIdFromCookie });

    req.logout();

    res.clearCookie("sessionId");

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Error logging out:", error);
    return res.status(500).json({
      error: true,
      message: "Failed to logout",
    });
  } finally {
    await client.close();
  }
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
