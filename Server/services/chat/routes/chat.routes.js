import express from 'express';
import multer from 'multer';
import { createConversation, getConversations, getMessages, saveMessage, updateConversation, deleteConversation, sendMessageToAi, getConversationById } from '../controller/chat.controller.js';
import { chatAgentRateLimiter } from '../middleware/rateLimiter.middleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const rawAgent = (req.body?.selectedAgent || req.body?.agent || "").toLowerCase();
    const isPdf = file.mimetype === "application/pdf" || (file.originalname || "").toLowerCase().endsWith(".pdf");

    if (rawAgent === "pdf" && !isPdf) {
      const err = new Error("Only PDF files are allowed.");
      err.code = "INVALID_FILE_TYPE";
      return cb(err, false);
    }
    cb(null, true);
  },
});

const router = express.Router();

router.post(
  "/message",
  upload.single("file"),
  chatAgentRateLimiter,
  sendMessageToAi
);

// createConversation must be POST (not GET)
router.post("/create-conversation", createConversation);

router.get("/get-conversations", getConversations);

router.get("/conversation/:conversationId", getConversationById);

router.post("/save-message", saveMessage);

router.patch("/update-conversation/:conversationId", updateConversation);

router.delete("/delete-conversation/:conversationId", deleteConversation);

router.get("/get-messages/:conversationId", getMessages);

export default router;