import { Strategy as LocalStrategy } from "passport-local";
import UserModel from "./database.mjs";
import passport from 'passport';
import { compareSync } from "bcrypt";

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await UserModel.findOne({ username: username });

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
    const user = await UserModel.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});
