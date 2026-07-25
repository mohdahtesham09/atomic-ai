import mongoose from "mongoose";

const AUTH_URI = process.env.MONGODB_AUTH_URI || "mongodb+srv://atomic_auth:wwVhMK2TpViuZtE5@cluster0.xtjdc7i.mongodb.net/auth";
const CHAT_URI = process.env.MONGODB_CHAT_URI || "mongodb+srv://atomic_auth:wwVhMK2TpViuZtE5@cluster0.xtjdc7i.mongodb.net/chat";

async function runMigration() {
  console.log("[Migration] Starting duplicate user migration...");

  const authConn = await mongoose.createConnection(AUTH_URI).asPromise();
  const chatConn = await mongoose.createConnection(CHAT_URI).asPromise();

  console.log("[Migration] Connected to auth and chat databases.");

  const User = authConn.collection("users");
  const Conversation = chatConn.collection("conversations");
  const Message = chatConn.collection("messages");
  const UserMemory = chatConn.collection("usermemories");
  const UserUsage = chatConn.collection("userusages");

  const allUsers = await User.find({}).toArray();
  console.log(`[Migration] Found ${allUsers.length} total user records in DB.`);

  // Group users by normalized email or firebaseUid
  const groups = new Map();

  for (const user of allUsers) {
    const key = (user.email ? user.email.toLowerCase().trim() : null) || user.firebaseUid;
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(user);
  }

  let totalMigratedUsers = 0;
  let totalConversationsUpdated = 0;
  let totalMessagesUpdated = 0;
  let totalMemoriesUpdated = 0;
  let totalUsagesUpdated = 0;
  let totalDeletedDuplicates = 0;

  for (const [key, userList] of groups.entries()) {
    if (userList.length < 2) continue;

    console.log(`\n[Migration] Found ${userList.length} duplicate records for key: ${key}`);

    // Sort to find primary user: prioritize user with firebaseUid, then oldest
    userList.sort((a, b) => {
      if (a.firebaseUid && !b.firebaseUid) return -1;
      if (!a.firebaseUid && b.firebaseUid) return 1;
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });

    const primaryUser = userList[0];
    const secondaryUsers = userList.slice(1);

    const primaryIdStr = primaryUser._id.toString();
    const secondaryIdStrs = secondaryUsers.map((u) => u._id.toString());

    console.log(`[Migration] Primary User ID: ${primaryIdStr} (email: ${primaryUser.email}, firebaseUid: ${primaryUser.firebaseUid})`);
    console.log(`[Migration] Secondary User IDs to merge: ${secondaryIdStrs.join(", ")}`);

    for (const secondaryId of secondaryIdStrs) {
      // 1. Reassign conversations
      const convRes = await Conversation.updateMany(
        { userId: secondaryId },
        { $set: { userId: primaryIdStr } }
      );
      totalConversationsUpdated += convRes.modifiedCount;

      // 2. Reassign messages
      const msgRes = await Message.updateMany(
        { userId: secondaryId },
        { $set: { userId: primaryIdStr } }
      );
      totalMessagesUpdated += msgRes.modifiedCount;

      // 3. Reassign memories if any
      const memRes = await UserMemory.updateMany(
        { userId: secondaryId },
        { $set: { userId: primaryIdStr } }
      );
      totalMemoriesUpdated += memRes.modifiedCount;

      // 4. Reassign usages if any
      const usgRes = await UserUsage.updateMany(
        { userId: secondaryId },
        { $set: { userId: primaryIdStr } }
      );
      totalUsagesUpdated += usgRes.modifiedCount;

      // Delete secondary user record
      await User.deleteOne({ _id: new mongoose.Types.ObjectId(secondaryId) });
      totalDeletedDuplicates++;
    }

    // Ensure primary user has firebaseUid and normalized email populated
    const updateFields = {};
    const firebaseUidCandidate = userList.find((u) => u.firebaseUid)?.firebaseUid;
    if (firebaseUidCandidate && !primaryUser.firebaseUid) {
      updateFields.firebaseUid = firebaseUidCandidate;
    }
    if (primaryUser.email && primaryUser.email !== primaryUser.email.toLowerCase()) {
      updateFields.email = primaryUser.email.toLowerCase();
    }
    if (Object.keys(updateFields).length > 0) {
      await User.updateOne({ _id: primaryUser._id }, { $set: updateFields });
    }

    totalMigratedUsers++;
  }

  console.log("\n================ MIGRATION SUMMARY ================");
  console.log(`Duplicate groups resolved: ${totalMigratedUsers}`);
  console.log(`Conversations updated: ${totalConversationsUpdated}`);
  console.log(`Messages updated: ${totalMessagesUpdated}`);
  console.log(`Memories updated: ${totalMemoriesUpdated}`);
  console.log(`Usages updated: ${totalUsagesUpdated}`);
  console.log(`Duplicate user records cleaned up: ${totalDeletedDuplicates}`);
  console.log("===================================================\n");

  await authConn.close();
  await chatConn.close();
  console.log("[Migration] Migration completed successfully.");
}

runMigration().catch((err) => {
  console.error("[Migration Error]:", err);
  process.exit(1);
});
