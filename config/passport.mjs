import { Strategy as LocalStrategy } from "passport-local";
import UserModel from "./database.mjs";
import passport from "passport";
import { compareSync } from "bcrypt";
import { MongoClient, ObjectId } from "mongodb";

const mongoUrl = `mongodb+srv://danielwari:${process.env.key}@ramppay.jmcq7vl.mongodb.net/ramppay`;
const client = new MongoClient(mongoUrl);

(async () => {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db();
    const usersCollection = db.collection("users");

    passport.use(
      new LocalStrategy(async (username, password, done) => {
        try {
          const user = await usersCollection.findOne({ username: username });
          // console.log(user);

          if (!user || !compareSync(password, user.password)) {
            return done(null, false, {
              message: "Incorrect username or password",
            });
          }

          return done(null, user);
        } catch (error) {
          console.error("Error in LocalStrategy:", error);
          return done(error);
        }
      })
    );

    passport.serializeUser((user, done) => {
      try {
        if (!user || !user._id.toString()) {
          throw new Error("Invalid user object provided for serialization");
        }
        done(null, user._id.toString());
      } catch (error) {
        console.error("Error in serializeUser:", error);
        done(error);
      }
    });

    passport.deserializeUser(async (id, done) => {
      try {
        const user = await usersCollection.findOne({ _id: new ObjectId(id) });

        if (!user) {
          return done(null, false, { message: "User not found" });
        }
        done(null, user);
      } catch (error) {
        console.error("Error in deserializeUser:", error);
        done(error);
      }
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
})();
