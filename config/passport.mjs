import { Strategy as LocalStrategy } from "passport-local";
import UserModel from "./database.mjs";
import passport from 'passport';
import { compareSync } from "bcrypt";
import { MongoClient } from "mongodb";

const mongoUrl = `mongodb+srv://danielwari:${process.env.key}@ramppay.jmcq7vl.mongodb.net/ramppay`;
const client = new MongoClient(mongoUrl);
await client.connect();

const db = client.db();
const usersCollection = db.collection("users");

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await usersCollection.findOne({ username: username });

      if (!user || !compareSync(password, user.password)) {
        return done(null, false);
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await usersCollection.findOne({ _id: id});
    done(null, user);
  } catch (error) {
    done(error);
  }
});
