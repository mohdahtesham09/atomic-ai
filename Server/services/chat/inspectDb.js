import mongoose from "mongoose";

const AUTH_URI = "mongodb+srv://atomic_auth:wwVhMK2TpViuZtE5@cluster0.xtjdc7i.mongodb.net/auth";
const CHAT_URI = "mongodb+srv://atomic_auth:wwVhMK2TpViuZtE5@cluster0.xtjdc7i.mongodb.net/chat";

async function inspectDb() {
  const authConn = await mongoose.createConnection(AUTH_URI).asPromise();
  const chatConn = await mongoose.createConnection(CHAT_URI).asPromise();

  console.log("Auth DB Collections:");
  const authCols = await authConn.db.listCollections().toArray();
  for (const col of authCols) {
    const count = await authConn.collection(col.name).countDocuments();
    console.log(`  - ${col.name}: ${count} docs`);
    if (col.name === "users") {
      const docs = await authConn.collection(col.name).find({}).toArray();
      console.log("    Docs:", JSON.stringify(docs, null, 2));
    }
  }

  console.log("\nChat DB Collections:");
  const chatCols = await chatConn.db.listCollections().toArray();
  for (const col of chatCols) {
    const count = await chatConn.collection(col.name).countDocuments();
    console.log(`  - ${col.name}: ${count} docs`);
    if (col.name === "conversations") {
      const convs = await chatConn.collection(col.name).find({}).toArray();
      console.log("    Conversations Sample:", JSON.stringify(convs.slice(0, 5), null, 2));
    }
  }

  await authConn.close();
  await chatConn.close();
}

inspectDb().catch(console.error);
