import mongoose from "mongoose";

const AUTH_URI = process.env.MONGODB_AUTH_URI || "mongodb+srv://atomic_auth:wwVhMK2TpViuZtE5@cluster0.xtjdc7i.mongodb.net/auth";
const CHAT_URI = process.env.MONGODB_CHAT_URI || "mongodb+srv://atomic_auth:wwVhMK2TpViuZtE5@cluster0.xtjdc7i.mongodb.net/chat";

export async function runMigration() {
  console.log("[Migration] Starting database user & conversation migration...");

  const authConn = await mongoose.createConnection(AUTH_URI).asPromise();
  const chatConn = await mongoose.createConnection(CHAT_URI).asPromise();

  const User = authConn.collection("users");
  const Conversation = chatConn.collection("conversations");
  const Message = chatConn.collection("messages");
  const UserMemory = chatConn.collection("usermemories");
  const UserUsage = chatConn.collection("userusages");

  const allUsers = await User.find({}).toArray();
  console.log(`[Migration] Found ${allUsers.length} user record(s) in auth DB.`);

  let totalMigratedUsers = 0;
  let totalConversationsUpdated = 0;
  let totalMessagesUpdated = 0;
  let totalMemoriesUpdated = 0;
  let totalUsagesUpdated = 0;
  let totalDeletedDuplicates = 0;

  // Step 1: Resolve duplicate users in users collection
  const groups = new Map();
  for (const user of allUsers) {
    const key = (user.email ? user.email.toLowerCase().trim() : null) || user.firebaseUid;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(user);
  }

  const primaryUserMap = new Map(); // oldUserId -> primaryUserId

  for (const [key, userList] of groups.entries()) {
    // Sort: user with firebaseUid first, then oldest
    userList.sort((a, b) => {
      if (a.firebaseUid && !b.firebaseUid) return -1;
      if (!a.firebaseUid && b.firebaseUid) return 1;
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });

    const primaryUser = userList[0];
    const primaryId = primaryUser._id.toString();

    for (const u of userList) {
      primaryUserMap.set(u._id.toString(), primaryId);
    }

    if (userList.length > 1) {
      const secondaryUsers = userList.slice(1);
      for (const sec of secondaryUsers) {
        const secId = sec._id.toString();
        const convRes = await Conversation.updateMany({ userId: secId }, { $set: { userId: primaryId } });
        totalConversationsUpdated += convRes.modifiedCount;

        const msgRes = await Message.updateMany({ userId: secId }, { $set: { userId: primaryId } });
        totalMessagesUpdated += msgRes.modifiedCount;

        const memRes = await UserMemory.updateMany({ userId: secId }, { $set: { userId: primaryId } });
        totalMemoriesUpdated += memRes.modifiedCount;

        const usgRes = await UserUsage.updateMany({ userId: secId }, { $set: { userId: primaryId } });
        totalUsagesUpdated += usgRes.modifiedCount;

        await User.deleteOne({ _id: sec._id });
        totalDeletedDuplicates++;
      }
      totalMigratedUsers++;
    }
  }

  // Step 2: Reassign orphaned conversations/messages to single active user if only 1 user exists
  const remainingUsers = await User.find({}).toArray();
  if (remainingUsers.length === 1) {
    const activeUser = remainingUsers[0];
    const activeUserId = activeUser._id.toString();

    console.log(`[Migration] Single active user found: ${activeUserId} (${activeUser.email})`);

    const convRes = await Conversation.updateMany(
      { userId: { $ne: activeUserId } },
      { $set: { userId: activeUserId } }
    );
    totalConversationsUpdated += convRes.modifiedCount;

    const msgRes = await Message.updateMany(
      { userId: { $ne: activeUserId } },
      { $set: { userId: activeUserId } }
    );
    totalMessagesUpdated += msgRes.modifiedCount;

    const memRes = await UserMemory.updateMany(
      { userId: { $ne: activeUserId } },
      { $set: { userId: activeUserId } }
    );
    totalMemoriesUpdated += memRes.modifiedCount;

    const usgRes = await UserUsage.updateMany(
      { userId: { $ne: activeUserId } },
      { $set: { userId: activeUserId } }
    );
    totalUsagesUpdated += usgRes.modifiedCount;
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

  return {
    totalMigratedUsers,
    totalConversationsUpdated,
    totalMessagesUpdated,
    totalMemoriesUpdated,
    totalUsagesUpdated,
    totalDeletedDuplicates,
  };
}

// Auto-run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  runMigration().catch((err) => {
    console.error("[Migration Error]:", err);
    process.exit(1);
  });
}
