import { createSlice } from "@reduxjs/toolkit";

const conversationSlice = createSlice({
  name: "conversation",
  initialState: {
    conversations: [],
    selectedConversation: null,
    loading: false,
    error: null
  },
  reducers: {
    setConversations: (state, action) => {
      state.conversations = action.payload;
    },
    addConversation: (state, action) => {
      state.conversations.unshift(action.payload);
    },
    setSelectedConversation: (state, action) => {
      state.selectedConversation = action.payload;
    },
    updateConversationTitle: (state, action) => {
      const { conversationId, title } = action.payload;
      const convIndex = state.conversations.findIndex((c) => (c._id || c.id) === conversationId);
      if (convIndex !== -1) {
        state.conversations[convIndex].title = title;
      }
      if (state.selectedConversation && (state.selectedConversation._id || state.selectedConversation.id) === conversationId) {
        state.selectedConversation.title = title;
      }
    },
    deleteConversationAction: (state, action) => {
      const conversationId = action.payload;
      state.conversations = state.conversations.filter((c) => (c._id || c.id) !== conversationId);
    },
    clearSelectedConversation: (state) => {
      state.selectedConversation = null;
    },
    clearConversations: (state) => {
      state.conversations = [];
      state.selectedConversation = null;
    }
  }
});

export const {
  setConversations,
  addConversation,
  setSelectedConversation,
  updateConversationTitle,
  deleteConversationAction,
  clearSelectedConversation,
  clearConversations
} = conversationSlice.actions;

export default conversationSlice.reducer;