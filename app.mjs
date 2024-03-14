import express, { json, urlencoded } from "express";
const app = express();
import "dotenv/config";
import cors from "cors";
import UserModel from "./config/database.mjs";
import { hashSync } from "bcrypt";
import passport from "passport";
import session from "express-session";
import cookieParser from "cookie-parser";
import "./config/passport.mjs";
import mongoPkg from "connect-mongo";
const { create } = mongoPkg;
import { MongoClient } from "mongodb";

const mongoUrl = `mongodb+srv://danielwari:${process.env.key}@ramppay.jmcq7vl.mongodb.net/ramppay-session`;
const client = new MongoClient(mongoUrl);
await client.connect();

app.use(
  cors({
    credentials: true,
    origin: `${process.env.origin}`,
  })
);

app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

app.get("/", (req, res) => {
  res.send("Welcome to RampPay Server");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong!");
});

const expirationDate = new Date(Date.now() + 3600000);

app.use(
  session({
    secret: `${process.env.key}`,
    resave: false,
    saveUninitialized: false,
    // store: create({
    //   client,
    //   ttl: 60 * 60,
    // }),
    cookie: {
      // httpOnly: true,
      // secure: true,
      expires: expirationDate,
      // sameSite: "none",
    },
  })
);

app.use(passport.session());

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
      try {
        return res.send({
          success: true,
          message: "Logged in successfully!",
        });
      } catch (error) {
        return res.send({
          error: true,
          message: "Internal server error",
        });
      }
    });
  })(req, res, next);
});

app.use("/protected", (req, res) => {
  if (req.isAuthenticated()) {
    res.status(200).json({
      success: true,
      data: {
        user: {
          fullname: req.user.fullname,
          username: req.user.username,
        },
      },
    });
  } else {
    res.status(401).json({
      error: true,
      message: "Authentication failed. User not authenticated.",
    });
  }
});

app.post("/logout", async (req, res) => {
  try {
    req.logout(() => {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
          return res.status(500).json({
            error: true,
            message: "Failed to logout",
          });
        } else {
          res.clearCookie("sessionId");
          res.clearCookie("connect.sid");
          res.status(200).json({
            success: true,
            message: "Logged out successfully",
          });
        }
      });
    });
  } catch (error) {
    console.error("Error logging out:", error);
    return res.status(500).json({
      error: true,
      message: "Failed to logout",
    });
  }
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on("exit", async () => {
  await client.close();
});