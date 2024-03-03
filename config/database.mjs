import { MongoClient } from "mongodb";
import { connect, Schema, model } from "mongoose";
import 'dotenv/config'

const mongoURI = `mongodb+srv://danielwari:${process.env.key}@ramppay.jmcq7vl.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(mongoURI);
const mongooseURI = `mongodb+srv://danielwari:${process.env.key}@ramppay.jmcq7vl.mongodb.net/ramppay`;

connect(mongooseURI);

const userSchema = Schema({
  fullname: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  usertoken: String,
});

const UserModel = model("User", userSchema);

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    await client.close();
  }
}

run().catch(console.dir);

export default UserModel;
