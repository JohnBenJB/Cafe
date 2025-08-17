# Communication Canister Documentation

## Overview

The Communication Canister provides real-time chat functionality for collaborative tables in the Cafe application. It enables users to communicate while working together on shared documents, with features including message sending, participant management, typing indicators, and system notifications.

## Data Types

### Core Identifiers
- `ChatId` (Nat32): Unique identifier for chat rooms
- `MessageId` (Nat32): Unique identifier for messages
- `UserId` (Principal): User identifier (Internet Computer Principal)
- `TableId` (Text): Reference to the table where chat is happening

### Chat Types
- `ChatInfo`: Basic chat room information
- `Chat`: Complete chat room with internal data structures
- `ParticipantInfo`: Information about chat participants

### Message Types
- `MessageContent`: Union type for different message content types
  - `#Text`: Plain text messages
  - `#File`: File attachments
  - `#Image`: Image attachments
  - `#System`: System notifications
- `Message`: Internal message structure
- `MessageResponse`: API response format for messages

### Utility Types
- `Paginated<T>`: Paginated results for large datasets
- `Result<T, E>`: Standard result type for error handling
- `Error`: Specific error types for the communication canister

## Public Functions

### Chat Management

#### `create_chat`
**Purpose**: Creates a new chat room for a collaborative table.

**Arguments**:
- `name` (Text): Display name for the chat room
- `tableId` (TableId): ID of the table this chat belongs to

**Return Value**: `Result<ChatId, Error>`
- `#Ok(chatId)`: Successfully created chat with new ID
- `#Err(#InvalidOperation)`: Invalid input or table already has chat

**Frontend Integration Example**:
```javascript
const createTableChat = async (tableId, chatName) => {
  try {
    const result = await communicationCanister.create_chat(chatName, tableId);
    if ('Ok' in result) {
      console.log('Chat created:', result.Ok);
      return result.Ok;
    } else {
      console.error('Failed to create chat:', result.Err);
    }
  } catch (error) {
    console.error('Error creating chat:', error);
  }
};
```

#### `get_chat_info`
**Purpose**: Retrieves basic information about a chat room.

**Arguments**:
- `chatId` (ChatId): ID of the chat to retrieve

**Return Value**: `Result<ChatInfo, Error>`
- `#Ok(chatInfo)`: Chat information including participants, creation time, etc.
- `#Err(#NotFound)`: Chat not found

**Frontend Integration Example**:
```javascript
const loadChatInfo = async (chatId) => {
  const result = await communicationCanister.get_chat_info(chatId);
  if ('Ok' in result) {
    const chatInfo = result.Ok;
    displayChatHeader(chatInfo.name, chatInfo.participants.length);
    updateLastMessageTime(chatInfo.lastMessageAt);
  }
};
```

#### `get_chat_by_table`
**Purpose**: Finds the chat associated with a specific table.

**Arguments**:
- `tableId` (TableId): ID of the table

**Return Value**: `Result<ChatId, Error>`
- `#Ok(chatId)`: Chat ID for the table
- `#Err(#NotFound)`: No chat found for this table

**Frontend Integration Example**:
```javascript
const joinTableChat = async (tableId) => {
  const result = await communicationCanister.get_chat_by_table(tableId);
  if ('Ok' in result) {
    const chatId = result.Ok;
    await loadChatMessages(chatId);
    startTypingIndicatorPolling(chatId);
  }
};
```

#### `list_user_chats`
**Purpose**: Lists all chats that a user is participating in.

**Arguments**:
- `userId` (UserId): User's Principal ID

**Return Value**: `Result<[ChatInfo], Error>`
- `#Ok(chatInfos)`: Array of chat information for user's chats
- `#Err(#InternalError)`: Internal error occurred

**Frontend Integration Example**:
```javascript
const loadUserChats = async (userId) => {
  const result = await communicationCanister.list_user_chats(userId);
  if ('Ok' in result) {
    const chats = result.Ok;
    displayChatList(chats.map(chat => ({
      id: chat.id,
      name: chat.name,
      lastMessageAt: chat.lastMessageAt,
      participantCount: chat.participants.length
    })));
  }
};
```

### Participant Management

#### `add_participant`
**Purpose**: Adds a new participant to an existing chat room.

**Arguments**:
- `chatId` (ChatId): ID of the chat
- `newParticipant` (UserId): Principal ID of user to add

**Return Value**: `Result<(), Error>`
- `#Ok(())`: Successfully added participant
- `#Err(#AccessDenied)`: Caller not in chat
- `#Err(#InvalidOperation)`: User already in chat
- `#Err(#ChatFull)`: Chat has reached maximum participants
- `#Err(#NotFound)`: Chat not found

**Frontend Integration Example**:
```javascript
const addChatParticipant = async (chatId, newUserId) => {
  const result = await communicationCanister.add_participant(chatId, newUserId);
  if ('Ok' in result) {
    showNotification('User added to chat');
    refreshChatParticipants(chatId);
  } else {
    showError(`Failed to add user: ${result.Err}`);
  }
};
```

#### `remove_participant`
**Purpose**: Removes a participant from a chat room.

**Arguments**:
- `chatId` (ChatId): ID of the chat
- `participantToRemove` (UserId): Principal ID of user to remove

**Return Value**: `Result<(), Error>`
- `#Ok(())`: Successfully removed participant
- `#Err(#AccessDenied)`: Caller not in chat
- `#Err(#UserNotInChat)`: User to remove not in chat
- `#Err(#NotFound)`: Chat not found

**Frontend Integration Example**:
```javascript
const removeChatParticipant = async (chatId, userId) => {
  const result = await communicationCanister.remove_participant(chatId, userId);
  if ('Ok' in result) {
    showNotification('User removed from chat');
    refreshChatParticipants(chatId);
  }
};
```

#### `get_chat_participants`
**Purpose**: Retrieves list of all participants in a chat.

**Arguments**:
- `chatId` (ChatId): ID of the chat

**Return Value**: `Result<[ParticipantInfo], Error>`
- `#Ok(participants)`: Array of participant information
- `#Err(#NotFound)`: Chat not found

**Frontend Integration Example**:
```javascript
const loadChatParticipants = async (chatId) => {
  const result = await communicationCanister.get_chat_participants(chatId);
  if ('Ok' in result) {
    const participants = result.Ok;
    displayParticipantList(participants.map(p => ({
      userId: p.userId,
      joinedAt: p.joinedAt,
      lastSeen: p.lastSeen,
      isActive: p.isActive
    })));
  }
};
```

#### `update_last_seen`
**Purpose**: Updates the user's last seen timestamp in a chat.

**Arguments**:
- `chatId` (ChatId): ID of the chat

**Return Value**: `Result<(), Error>`
- `#Ok(())`: Successfully updated last seen time
- `#Err(#UserNotInChat)`: User not in chat
- `#Err(#NotFound)`: Chat not found

**Frontend Integration Example**:
```javascript
const updateUserPresence = async (chatId) => {
  await communicationCanister.update_last_seen(chatId);
};

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentChatId) {
    updateUserPresence(currentChatId);
  }
});
```

### Message Management

#### `send_message`
**Purpose**: Sends a new message to a chat room.

**Arguments**:
- `chatId` (ChatId): ID of the chat
- `content` (MessageContent): Message content (text, file, image, or system)

**Return Value**: `Result<MessageId, Error>`
- `#Ok(messageId)`: Successfully sent message with new ID
- `#Err(#MessageTooLong)`: Message exceeds length limit
- `#Err(#UserNotInChat)`: User not in chat
- `#Err(#NotFound)`: Chat not found

**Frontend Integration Example**:
```javascript
const sendTextMessage = async (chatId, text) => {
  const content = { Text: text };
  const result = await communicationCanister.send_message(chatId, content);
  if ('Ok' in result) {
    console.log('Message sent:', result.Ok);
  } else {
    showError(`Failed to send message: ${result.Err}`);
  }
};

const sendFileMessage = async (chatId, fileName, fileSize, fileUrl) => {
  const content = { 
    File: { 
      name: fileName, 
      size: fileSize, 
      url: fileUrl 
    } 
  };
  await communicationCanister.send_message(chatId, content);
};
```

#### `get_messages`
**Purpose**: Retrieves paginated messages from a chat room.

**Arguments**:
- `chatId` (ChatId): ID of the chat
- `offset` (Nat): Number of messages to skip
- `limit` (Nat): Maximum number of messages to return

**Return Value**: `Result<Paginated<MessageResponse>, Error>`
- `#Ok(paginatedMessages)`: Paginated message results
- `#Err(#NotFound)`: Chat not found

**Frontend Integration Example**:
```javascript
const loadChatMessages = async (chatId, offset = 0, limit = 50) => {
  const result = await communicationCanister.get_messages(chatId, offset, limit);
  if ('Ok' in result) {
    const { items: messages, next, total } = result.Ok;
    displayMessages(messages);
    
    if (next) {
      enableLoadMoreButton(() => loadChatMessages(chatId, next, limit));
    }
  }
};

const startMessagePolling = (chatId) => {
  setInterval(async () => {
    const result = await communicationCanister.get_messages(chatId, 0, 10);
    if ('Ok' in result) {
      const newMessages = result.Ok.items;
      appendNewMessages(newMessages);
    }
  }, 2000);
};
```

#### `edit_message`
**Purpose**: Edits an existing message in a chat.

**Arguments**:
- `chatId` (ChatId): ID of the chat
- `messageId` (MessageId): ID of the message to edit
- `newContent` (MessageContent): New message content

**Return Value**: `Result<(), Error>`
- `#Ok(())`: Successfully edited message
- `#Err(#MessageTooLong)`: New content too long
- `#Err(#UserNotInChat)`: User not in chat
- `#Err(#AccessDenied)`: User not the message sender
- `#Err(#NotFound)`: Chat or message not found

**Frontend Integration Example**:
```javascript
const editMessage = async (chatId, messageId, newText) => {
  const newContent = { Text: newText };
  const result = await communicationCanister.edit_message(chatId, messageId, newContent);
  if ('Ok' in result) {
    showNotification('Message edited');
    refreshChatMessages(chatId);
  } else {
    showError(`Failed to edit message: ${result.Err}`);
  }
};
```

#### `delete_message`
**Purpose**: Marks a message as deleted in a chat.

**Arguments**:
- `chatId` (ChatId): ID of the chat
- `messageId` (MessageId): ID of the message to delete

**Return Value**: `Result<(), Error>`
- `#Ok(())`: Successfully deleted message
- `#Err(#UserNotInChat)`: User not in chat
- `#Err(#AccessDenied)`: User not the message sender
- `#Err(#NotFound)`: Chat or message not found

**Frontend Integration Example**:
```javascript
const deleteMessage = async (chatId, messageId) => {
  const result = await communicationCanister.delete_message(chatId, messageId);
  if ('Ok' in result) {
    showNotification('Message deleted');
    refreshChatMessages(chatId);
  } else {
    showError(`Failed to delete message: ${result.Err}`);
  }
};
```

### Typing Indicators

#### `set_typing_status`
**Purpose**: Sets the user's typing status in a chat.

**Arguments**:
- `chatId` (ChatId): ID of the chat
- `isTyping` (Bool): Whether user is currently typing

**Return Value**: `Result<(), Error>`
- `#Ok(())`: Successfully updated typing status
- `#Err(#UserNotInChat)`: User not in chat
- `#Err(#NotFound)`: Chat not found

**Frontend Integration Example**:
```javascript
let typingTimeout;

const handleTypingStart = async (chatId) => {
  await communicationCanister.set_typing_status(chatId, true);
  
  if (typingTimeout) clearTimeout(typingTimeout);
  
  typingTimeout = setTimeout(async () => {
    await communicationCanister.set_typing_status(chatId, false);
  }, 3000);
};

const handleTypingStop = async (chatId) => {
  if (typingTimeout) clearTimeout(typingTimeout);
  await communicationCanister.set_typing_status(chatId, false);
};

messageInput.addEventListener('input', () => handleTypingStart(chatId));
messageInput.addEventListener('blur', () => handleTypingStop(chatId));
```

#### `get_typing_users`
**Purpose**: Retrieves list of users currently typing in a chat.

**Arguments**:
- `chatId` (ChatId): ID of the chat

**Return Value**: `Result<[UserId], Error>`
- `#Ok(typingUsers)`: Array of user IDs currently typing
- `#Err(#NotFound)`: Chat not found

**Frontend Integration Example**:
```javascript
const startTypingIndicatorPolling = (chatId) => {
  setInterval(async () => {
    const result = await communicationCanister.get_typing_users(chatId);
    if ('Ok' in result) {
      const typingUsers = result.Ok;
      displayTypingIndicators(typingUsers);
    }
  }, 1000);
};

const displayTypingIndicators = (typingUsers) => {
  if (typingUsers.length > 0) {
    const names = typingUsers.map(id => getUserDisplayName(id));
    showTypingMessage(`${names.join(', ')} is typing...`);
  } else {
    hideTypingMessage();
  }
};
```

### Utility Functions

#### `get_chat_stats`
**Purpose**: Retrieves statistics about a chat room.

**Arguments**:
- `chatId` (ChatId): ID of the chat

**Return Value**: `Result<{ participantCount : Nat; messageCount : Nat; lastMessageAt : Time.Time }, Error>`
- `#Ok(stats)`: Chat statistics
- `#Err(#NotFound)`: Chat not found

**Frontend Integration Example**:
```javascript
const loadChatStats = async (chatId) => {
  const result = await communicationCanister.get_chat_stats(chatId);
  if ('Ok' in result) {
    const { participantCount, messageCount, lastMessageAt } = result.Ok;
    updateChatHeader({
      participants: participantCount,
      messages: messageCount,
      lastActivity: lastMessageAt
    });
  }
};
```

#### `get_all_chats`
**Purpose**: Retrieves all chats (admin function).

**Arguments**: None

**Return Value**: `Result<[ChatInfo], Error>`
- `#Ok(allChats)`: Array of all chat information
- `#Err(#InternalError)`: Internal error occurred

**Frontend Integration Example**:
```javascript
const loadAllChats = async () => {
  const result = await communicationCanister.get_all_chats();
  if ('Ok' in result) {
    const chats = result.Ok;
    displayAdminChatList(chats);
  }
};
```

#### `cleanup_typing_indicators`
**Purpose**: Manually cleans up expired typing indicators.

**Arguments**: None

**Return Value**: `Result<Nat, Error>`
- `#Ok(cleanedCount)`: Number of indicators cleaned up
- `#Err(#InternalError)`: Internal error occurred

**Frontend Integration Example**:
```javascript
const cleanupTypingIndicators = async () => {
  const result = await communicationCanister.cleanup_typing_indicators();
  if ('Ok' in result) {
    console.log(`Cleaned up ${result.Ok} typing indicators`);
  }
};
```

#### `delete_chat`
**Purpose**: Permanently deletes a chat room (admin function).

**Arguments**:
- `chatId` (ChatId): ID of the chat to delete

**Return Value**: `Result<(), Error>`
- `#Ok(())`: Successfully deleted chat
- `#Err(#NotFound)`: Chat not found

**Frontend Integration Example**:
```javascript
const deleteChat = async (chatId) => {
  if (confirm('Are you sure you want to delete this chat?')) {
    const result = await communicationCanister.delete_chat(chatId);
    if ('Ok' in result) {
      showNotification('Chat deleted');
      refreshChatList();
    }
  }
};
```

## User Story: Collaborative Table Chat Experience

### Scenario: Sarah and John Collaborate on a Project Table

Sarah is working on a collaborative table for her team's project planning. She wants to discuss the project with her colleague John in real-time while they both work on the document.

#### 1. Initial Setup
**Sarah's Actions:**
- Opens the project table in the Cafe application
- The frontend automatically calls `get_chat_by_table(tableId)` to check if a chat exists
- Since no chat exists, Sarah clicks "Start Chat" button
- Frontend calls `create_chat("Project Planning Chat", tableId)`
- Chat is created with Sarah as the first participant
- System message "Chat created" appears in the chat window

**Key Functions Used:**
- `get_chat_by_table()` - Check for existing chat
- `create_chat()` - Create new chat room

#### 2. Inviting John
**Sarah's Actions:**
- Clicks "Add Participant" in the chat interface
- Selects John from the user list
- Frontend calls `add_participant(chatId, johnUserId)`
- John is added to the chat
- System message "User joined the chat" appears

**John's Experience:**
- Receives notification that he's been added to the project chat
- Opens the table and sees the chat panel
- Frontend automatically calls `update_last_seen(chatId)` to mark his presence

**Key Functions Used:**
- `add_participant()` - Add John to chat
- `update_last_seen()` - Mark John's presence

#### 3. Real-time Communication
**Sarah's Actions:**
- Types "Hi John, can you review the budget section?" in the chat
- Frontend calls `set_typing_status(chatId, true)` when she starts typing
- Sends the message by calling `send_message(chatId, { Text: "Hi John, can you review the budget section?" })`
- Message appears in her chat window immediately

**John's Experience:**
- Sees "Sarah is typing..." indicator via `get_typing_users(chatId)` polling
- Receives Sarah's message through `get_messages(chatId, 0, 50)` polling
- Types a reply: "Sure, I'll take a look at it"
- Sends reply using `send_message(chatId, { Text: "Sure, I'll take a look at it" })`

**Key Functions Used:**
- `set_typing_status()` - Show typing indicators
- `send_message()` - Send messages
- `get_typing_users()` - Poll for typing indicators
- `get_messages()` - Poll for new messages

#### 4. File Sharing
**Sarah's Actions:**
- Wants to share a budget spreadsheet
- Uploads file to storage and gets file URL
- Sends file message: `send_message(chatId, { File: { name: "budget.xlsx", size: 245760, url: "..." } })`
- File appears as an attachment in the chat

**John's Experience:**
- Sees file attachment in chat
- Can click to download and review the budget file

**Key Functions Used:**
- `send_message()` - Send file attachment

#### 5. Message Management
**Sarah's Actions:**
- Realizes she made a typo in her message
- Clicks "Edit" on her message
- Changes "budget" to "budget spreadsheet"
- Frontend calls `edit_message(chatId, messageId, { Text: "Hi John, can you review the budget spreadsheet section?" })`
- Message shows "(edited)" indicator

**John's Experience:**
- Sees the edited message with edit indicator
- Can see the updated content

**Key Functions Used:**
- `edit_message()` - Edit existing message

#### 6. Chat Management
**Sarah's Actions:**
- Wants to see who's currently in the chat
- Frontend calls `get_chat_participants(chatId)`
- Sees list of participants with their join times and last seen

**John's Actions:**
- Accidentally sends a message with sensitive information
- Quickly deletes it using `delete_message(chatId, messageId)`
- Message shows as "This message was deleted"

**Key Functions Used:**
- `get_chat_participants()` - View participant list
- `delete_message()` - Delete sensitive message

#### 7. Chat Statistics and Monitoring
**Sarah's Actions:**
- Wants to see chat activity
- Frontend calls `get_chat_stats(chatId)`
- Sees participant count, message count, and last activity time

**Key Functions Used:**
- `get_chat_stats()` - View chat statistics

#### 8. Session Management
**Both Users:**
- Continue working on the table while chatting
- Frontend periodically calls `update_last_seen(chatId)` to maintain presence
- Typing indicators automatically expire after 5 seconds via system heartbeat
- Chat remains active and functional throughout the collaboration session

**Key Functions Used:**
- `update_last_seen()` - Maintain user presence
- System `heartbeat()` - Clean up expired typing indicators

### Frontend Integration Flow

1. **Table Opening**: Auto-check for existing chat → Create if needed → Join chat
2. **Real-time Updates**: Poll for messages and typing indicators every 1-2 seconds
3. **User Interactions**: Handle typing, sending, editing, and deleting messages
4. **Presence Management**: Update last seen times and show participant status
5. **Error Handling**: Display appropriate error messages for failed operations
6. **UI Updates**: Refresh chat display, participant list, and typing indicators

### Key Frontend Functions to Implement

```javascript
// Core chat management
const initializeChat = async (tableId) => { /* ... */ };
const sendMessage = async (chatId, content) => { /* ... */ };
const loadMessages = async (chatId, offset, limit) => { /* ... */ };

// Real-time features
const startChatPolling = (chatId) => { /* ... */ };
const handleTypingIndicator = (chatId, isTyping) => { /* ... */ };

// Participant management
const addParticipant = async (chatId, userId) => { /* ... */ };
const loadParticipants = async (chatId) => { /* ... */ };

// Message management
const editMessage = async (chatId, messageId, newContent) => { /* ... */ };
const deleteMessage = async (chatId, messageId) => { /* ... */ };
```

This user story demonstrates how all the communication canister functions work together to provide a seamless collaborative chat experience within the Cafe application's table collaboration feature.
