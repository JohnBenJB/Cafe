import Types "./types";
import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat32 "mo:base/Nat32";
import Nat64 "mo:base/Nat64";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import Bool "mo:base/Bool";
import Option "mo:base/Option";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Iter "mo:base/Iter";
import Error "mo:base/Error";
import Debug "mo:base/Debug";

// ===== COMMUNICATION CANISTER MAIN MODULE =====
// Handles chat functionality for collaborative tables

actor {
  // Import types
  public type ChatId = Types.ChatId;
  public type MessageId = Types.MessageId;
  public type ChatInfo = Types.ChatInfo;
  public type Chat = Types.Chat;
  public type ParticipantInfo = Types.ParticipantInfo;
  public type Message = Types.Message;
  public type MessageResponse = Types.MessageResponse;
  public type MessageContent = Types.MessageContent;
  public type ChatEvent = Types.ChatEvent;
  public type Error = Types.Error;
  public type Result<T, E> = Types.Result<T, E>;
  public type Paginated<T> = Types.Paginated<T>;

  // ===== STABLE STATE =====

  // Schema version for upgrades
  stable var schemaVersion : Nat32 = 1;

  // Global counters
  stable var nextChatId : Nat32 = 0;
  stable var nextMessageId : Nat32 = 0;

  // ===== UPGRADE/DOWNGRADE =====

  // Stable arrays for upgrade serialization
  stable var stableChats : [(ChatId, Chat)] = [];
  stable var stableChatsByTable : [(Nat, ChatId)] = [];

  system func preupgrade() {
    // Serialize chats
    stableChats := Iter.toArray(chats.entries());
    
    // Serialize table-chat mappings
    stableChatsByTable := Iter.toArray(chatsByTable.entries());
    
    // Update global counters
    nextChatId := nextChatId;
    nextMessageId := nextMessageId;
  };

  system func postupgrade() {
    // Restore chats
    for ((chatId, chat) in stableChats.vals()) {
      chats.put(chatId, chat);
    };
    
    // Restore table-chat mappings
    for ((tableId, chatId) in stableChatsByTable.vals()) {
      chatsByTable.put(tableId, chatId);
    };
    
    // Clear stable arrays
    stableChats := [];
    stableChatsByTable := [];
  };

  // ===== STATE MANAGEMENT =====

  // Chat storage
  var chats = HashMap.HashMap<ChatId, Chat>(0, Nat32.equal, func(x : Nat32) : Nat { Nat32.toNat(x) });

  // Table to chat mapping (one chat per table)
  var chatsByTable = HashMap.HashMap<Nat, ChatId>(0, Nat.equal, Hash.hash);

  // User typing status
  var typingUsers = HashMap.HashMap<ChatId, HashMap.HashMap<Principal, Time.Time>>(0, Nat32.equal, Hash.hash);

  // ===== CHAT MANAGEMENT =====

  // Create a new chat for a table
  public shared ({ caller }) func create_chat(
    tableId : Nat
  ) : async Result<ChatId, Error> {
    switch (await TableManagement.get_table(tableId)) {
      case (#err(error)) {
        return #err(#NotFound);
      };
      case (#ok(table)) {

      };
    };
    
    // Check if table already has a chat
    switch (chatsByTable.get(tableId)) {
      case (?existingChatId) {
        return #Err(#InvalidOperation); // Table already has a chat
      };
      case null { /* Continue */ };
    };
    
    // Generate new chat ID
    let chatId = nextChatId;
    nextChatId += 1;
    
    // Create chat info
    let now = Types.now();
    let chatInfo : ChatInfo = {
      id = chatId;
      tableId = tableId;
      participants = [caller]; // Creator is first participant
      createdAt = now;
      lastMessageAt = now;
      isActive = true;
    };
    
    // Create participant info for creator
    let participantInfo : ParticipantInfo = {
      userPrincipal = caller;
      joinedAt = now;
      lastSeen = now;
      isActive = true;
    };
    
    // Create chat
    let chat : Chat = {
      info = chatInfo;
      messages = HashMap.HashMap<MessageId, Message>(0, Nat32.equal, Hash.hash);
      participants = HashMap.HashMap<Principal, ParticipantInfo>(0, Principal.equal, Principal.hash);
      nextMessageId = 0;
    };
    
    // Add creator as participant
    chat.participants.put(caller, participantInfo);
    
    // Store chat
    chats.put(chatId, chat);
    chatsByTable.put(tableId, chatId);
    
    // Create system message for chat creation
    let systemMessage : Message = {
      id = chat.nextMessageId;
      chatId = chatId;
      senderId = caller;
      content = #System("Chat created");
      timestamp = now;
      isEdited = false;
      isDeleted = false;
      replyTo = null;
    };
    
    chat.messages.put(chat.nextMessageId, systemMessage);
    chat.nextMessageId += 1;
    
    #Ok(chatId);
  };

  // Get chat information
  public query func get_chat_info(chatId : ChatId) : async Result<ChatInfo, Error> {
    switch (chats.get(chatId)) {
      case (?chat) {
        #Ok(chat.info);
      };
      case null { #Err(#NotFound) };
    };
  };

  // Get chat for a table
  public query func get_chat_by_table(tableId : Nat) : async Result<ChatId, Error> {
    switch (chatsByTable.get(tableId)) {
      case (?chatId) { #Ok(chatId) };
      case null { #Err(#NotFound) };
    };
  };

  // List all chats for a user
  public query func list_user_chats(userPrincipal : Principal) : async Result<[ChatInfo], Error> {
    let userChats = Buffer.Buffer<ChatInfo>(0);
    
    for ((_, chat) in chats.entries()) {
      if (Types.isUserInChat(userPrincipal, chat.info.participants)) {
        userChats.add(chat.info);
      };
    };
    
    #Ok(Buffer.toArray(userChats));
  };

  // ===== PARTICIPANT MANAGEMENT =====

  // Add participant to chat
  public shared ({ caller }) func add_participant(
    chatId : ChatId,
    newParticipant : Principal
  ) : async Result<(), Error> {
    
    switch (chats.get(chatId)) {
      case (?chat) {
        // Check if caller is already a participant
        if (not Types.isUserInChat(caller, chat.info.participants)) {
          return #Err(#AccessDenied);
        };
        
        // Check if new participant is already in chat
        if (Types.isUserInChat(newParticipant, chat.info.participants)) {
          return #Err(#InvalidOperation);
        };
        
        // Check if chat is full
        if (chat.info.participants.size() >= Types.MAX_CHAT_PARTICIPANTS) {
          return #Err(#ChatFull);
        };
        
        // Add participant
        let now = Types.now();
        let participantInfo : ParticipantInfo = {
          userPrincipal = newParticipant;
          joinedAt = now;
          lastSeen = now;
          isActive = true;
        };
        
        chat.participants.put(newParticipant, participantInfo);
        
        // Update chat info
        let newParticipants = Array.append(chat.info.participants, [newParticipant]);
        chat.info.participants := newParticipants;
        
        // Create system message
        let systemMessage : Message = {
          id = chat.nextMessageId;
          chatId = chatId;
          senderId = newParticipant;
          content = #System("User joined the chat");
          timestamp = now;
          isEdited = false;
          isDeleted = false;
          replyTo = null;
        };
        
        chat.messages.put(chat.nextMessageId, systemMessage);
        chat.nextMessageId += 1;
        
        #Ok(());
      };
      case null { #Err(#NotFound) };
    };
  };

  // Remove participant from chat
  public shared ({ caller }) func remove_participant(
    chatId : ChatId,
    participantToRemove : Principal
  ) : async Result<(), Error> {
    
    switch (chats.get(chatId)) {
      case (?chat) {
        // Check if caller is a participant
        if (not Types.isUserInChat(caller, chat.info.participants)) {
          return #Err(#AccessDenied);
        };
        
        // Check if participant to remove is in chat
        if (not Types.isUserInChat(participantToRemove, chat.info.participants)) {
          return #Err(#UserNotInChat);
        };
        
        // Remove participant
        chat.participants.delete(participantToRemove);
        
        // Update chat info
        let filteredParticipants = Array.filter<Principal>(
          chat.info.participants,
          func(p : Principal) : Bool { not Principal.equal(p, participantToRemove) }
        );
        chat.info.participants := filteredParticipants;
        
        // Create system message
        let now = Types.now();
        let systemMessage : Message = {
          id = chat.nextMessageId;
          chatId = chatId;
          senderId = participantToRemove;
          content = #System("User left the chat");
          timestamp = now;
          isEdited = false;
          isDeleted = false;
          replyTo = null;
        };
        
        chat.messages.put(chat.nextMessageId, systemMessage);
        chat.nextMessageId += 1;
        
        #Ok(());
      };
      case null { #Err(#NotFound) };
    };
  };

  // Get chat participants
  public query func get_chat_participants(chatId : ChatId) : async Result<[ParticipantInfo], Error> {
    switch (chats.get(chatId)) {
      case (?chat) {
        let participants = Buffer.Buffer<ParticipantInfo>(0);
        for ((_, participant) in chat.participants.entries()) {
          participants.add(participant);
        };
        #Ok(Buffer.toArray(participants));
      };
      case null { #Err(#NotFound) };
    };
  };

  // Update user's last seen time
  public shared ({ caller }) func update_last_seen(chatId : ChatId) : async Result<(), Error> {
    switch (chats.get(chatId)) {
      case (?chat) {
        switch (chat.participants.get(caller)) {
          case (?participant) {
            let updatedParticipant : ParticipantInfo = {
              userPrincipal = caller;
              joinedAt = participant.joinedAt;
              lastSeen = Types.now();
              isActive = true;
            };
            chat.participants.put(caller, updatedParticipant);
            #Ok(());
          };
          case null { #Err(#UserNotInChat) };
        };
      };
      case null { #Err(#NotFound) };
    };
  };

  // ===== MESSAGE MANAGEMENT =====

  // Send a message
  public shared ({ caller }) func send_message(
    chatId : ChatId,
    content : MessageContent
  ) : async Result<MessageId, Error> {
    
    // Validate message content
    if (not Types.validateMessageContent(content)) {
      return #Err(#MessageTooLong);
    };
    
    switch (chats.get(chatId)) {
      case (?chat) {
        // Check if user is in chat
        if (not Types.isUserInChat(caller, chat.info.participants)) {
          return #Err(#UserNotInChat);
        };
        
        // Create message
        let now = Types.now();
        let messageId = chat.nextMessageId;
        let message : Message = {
          id = messageId;
          chatId = chatId;
          senderId = caller;
          content = content;
          timestamp = now;
          isEdited = false;
          isDeleted = false;
          replyTo = null;
        };
        
        // Store message
        chat.messages.put(messageId, message);
        chat.nextMessageId += 1;
        
        // Update chat's last message time
        chat.info.lastMessageAt := now;
        
        // Update user's last seen time
        switch (chat.participants.get(caller)) {
          case (?participant) {
            let updatedParticipant : ParticipantInfo = {
              userPrincipal = caller;
              joinedAt = participant.joinedAt;
              lastSeen = now;
              isActive = true;
            };
            chat.participants.put(caller, updatedParticipant);
          };
          case null { /* Shouldn't happen */ };
        };
        
        #Ok(messageId);
      };
      case null { #Err(#NotFound) };
    };
  };

  // Get messages from chat
  public query func get_messages(
    chatId : ChatId,
    offset : Nat,
    limit : Nat
  ) : async Result<Paginated<MessageResponse>, Error> {
    
    switch (chats.get(chatId)) {
      case (?chat) {
        let messages = Buffer.Buffer<MessageResponse>(0);
        var total : Nat = 0;
        
        // Convert messages to array and sort by timestamp (newest first)
        let messageArray = Iter.toArray(chat.messages.entries());
        let sortedMessages = Array.sort(messageArray, func(a : (MessageId, Message), b : (MessageId, Message)) : { #less; #equal; #greater } {
          if (a.1.timestamp > b.1.timestamp) { #less } else if (a.1.timestamp < b.1.timestamp) { #greater } else { #equal };
        });
        
        for ((_, message) in sortedMessages.vals()) {
          total += 1;
          if (messages.size() < limit and total > offset) {
            // Convert to MessageResponse (simplified - in real app you'd resolve sender name)
            let messageResponse : MessageResponse = {
              id = message.id;
              senderId = message.senderId;
              senderName = Principal.toText(message.senderId); // Simplified
              content = message.content;
              timestamp = message.timestamp;
              isEdited = message.isEdited;
              isDeleted = message.isDeleted;
              replyTo = message.replyTo;
            };
            messages.add(messageResponse);
          };
        };
        
        let nextOffset = if (offset + limit < total) { ?(offset + limit) } else { null };
        
        #Ok({
          items = Buffer.toArray(messages);
          next = nextOffset;
          total = total;
        });
      };
      case null { #Err(#NotFound) };
    };
  };

  // Edit a message
  public shared ({ caller }) func edit_message(
    chatId : ChatId,
    messageId : MessageId,
    newContent : MessageContent
  ) : async Result<(), Error> {
    
    // Validate new content
    if (not Types.validateMessageContent(newContent)) {
      return #Err(#MessageTooLong);
    };
    
    switch (chats.get(chatId)) {
      case (?chat) {
        // Check if user is in chat
        if (not Types.isUserInChat(caller, chat.info.participants)) {
          return #Err(#UserNotInChat);
        };
        
        // Get message
        switch (chat.messages.get(messageId)) {
          case (?message) {
            // Check if user is the sender
            if (not Principal.equal(caller, message.senderId)) {
              return #Err(#AccessDenied);
            };
            
            // Update message
            let updatedMessage : Message = {
              id = message.id;
              chatId = message.chatId;
              senderId = message.senderId;
              content = newContent;
              timestamp = message.timestamp;
              isEdited = true;
              isDeleted = message.isDeleted;
              replyTo = message.replyTo;
            };
            
            chat.messages.put(messageId, updatedMessage);
            #Ok(());
          };
          case null { #Err(#NotFound) };
        };
      };
      case null { #Err(#NotFound) };
    };
  };

  // Delete a message
  public shared ({ caller }) func delete_message(
    chatId : ChatId,
    messageId : MessageId
  ) : async Result<(), Error> {
    
    switch (chats.get(chatId)) {
      case (?chat) {
        // Check if user is in chat
        if (not Types.isUserInChat(caller, chat.info.participants)) {
          return #Err(#UserNotInChat);
        };
        
        // Get message
        switch (chat.messages.get(messageId)) {
          case (?message) {
            // Check if user is the sender
            if (not Principal.equal(caller, message.senderId)) {
              return #Err(#AccessDenied);
            };
            
            // Mark message as deleted
            let updatedMessage : Message = {
              id = message.id;
              chatId = message.chatId;
              senderId = message.senderId;
              content = message.content;
              timestamp = message.timestamp;
              isEdited = message.isEdited;
              isDeleted = true;
              replyTo = message.replyTo;
            };
            
            chat.messages.put(messageId, updatedMessage);
            #Ok(());
          };
          case null { #Err(#NotFound) };
        };
      };
      case null { #Err(#NotFound) };
    };
  };

  // ===== TYPING INDICATORS =====

  // Set user typing status
  public shared ({ caller }) func set_typing_status(
    chatId : ChatId,
    isTyping : Bool
  ) : async Result<(), Error> {
    
    switch (chats.get(chatId)) {
      case (?chat) {
        // Check if user is in chat
        if (not Types.isUserInChat(caller, chat.info.participants)) {
          return #Err(#UserNotInChat);
        };
        
        switch (typingUsers.get(chatId)) {
          case (?chatTypingUsers) {
            if (isTyping) {
              chatTypingUsers.put(caller, Types.now());
            } else {
              chatTypingUsers.delete(caller);
            };
          };
          case null {
            if (isTyping) {
              let newChatTypingUsers = HashMap.HashMap<Principal, Time.Time>(0, Principal.equal, Principal.hash);
              newChatTypingUsers.put(caller, Types.now());
              typingUsers.put(chatId, newChatTypingUsers);
            };
          };
        };
        
        #Ok(());
      };
      case null { #Err(#NotFound) };
    };
  };

  // Get typing users for a chat
  public query func get_typing_users(chatId : ChatId) : async Result<[Principal], Error> {
    switch (typingUsers.get(chatId)) {
      case (?chatTypingUsers) {
        let typingUserPrincipals = Buffer.Buffer<Principal>(0);
        let now = Types.now();
        
        for ((userPrincipal, timestamp) in chatTypingUsers.entries()) {
          // Only include users who typed recently
          if ((now - timestamp) < Types.TYPING_TIMEOUT_NANOS) {
            typingUserPrincipals.add(userPrincipal);
          };
        };
        
        #Ok(Buffer.toArray(typingUserPrincipals));
      };
      case null { #Ok([]) };
    };
  };

  // ===== UTILITY FUNCTIONS =====

  // Get chat statistics
  public query func get_chat_stats(chatId : ChatId) : async Result<{ participantCount : Nat; messageCount : Nat; lastMessageAt : Time.Time }, Error> {
    switch (chats.get(chatId)) {
      case (?chat) {
        #Ok({
          participantCount = chat.info.participants.size();
          messageCount = chat.messages.size();
          lastMessageAt = chat.info.lastMessageAt;
        });
      };
      case null { #Err(#NotFound) };
    };
  };

  // Get all chats (for admin purposes)
  public query func get_all_chats() : async Result<[ChatInfo], Error> {
    let allChats = Buffer.Buffer<ChatInfo>(0);
    for ((_, chat) in chats.entries()) {
      allChats.add(chat.info);
    };
    #Ok(Buffer.toArray(allChats));
  };

  // Clean up old typing indicators
  public shared ({ caller }) func cleanup_typing_indicators() : async Result<Nat, Error> {
    var cleanedCount : Nat = 0;
    let now = Types.now();
    
    for ((chatId, chatTypingUsers) in typingUsers.entries()) {
      let toRemove = Buffer.Buffer<Principal>(0);
      
      for ((userPrincipal, timestamp) in chatTypingUsers.entries()) {
        if (now - timestamp >= Types.TYPING_TIMEOUT_NANOS) {
          toRemove.add(userPrincipal);
        };
      };
      
      for (userPrincipal in toRemove.vals()) {
        chatTypingUsers.delete(userPrincipal);
        cleanedCount += 1;
      };
    };
    
    #Ok(cleanedCount);
  };

  // Delete a chat (for admin purposes)
  public shared ({ caller }) func delete_chat(chatId : ChatId) : async Result<(), Error> {
    switch (chats.get(chatId)) {
      case (?chat) {
        // Remove from storage
        chats.delete(chatId);
        chatsByTable.delete(chat.info.tableId);
        typingUsers.delete(chatId);
        #Ok(());
      };
      case null { #Err(#NotFound) };
    };
  };

  // ===== SYSTEM FUNCTIONS =====

  // System heartbeat for maintenance
  system func heartbeat() : async () {
    // Clean up old typing indicators
    let now = Types.now();
    
    for ((chatId, chatTypingUsers) in typingUsers.entries()) {
      let toRemove = Buffer.Buffer<Principal>(0);
      
      for ((userPrincipal, timestamp) in chatTypingUsers.entries()) {
        if (now - timestamp >= Types.TYPING_TIMEOUT_NANOS) {
          toRemove.add(userPrincipal);
        };
      };
      
      for (userPrincipal in toRemove.vals()) {
        chatTypingUsers.delete(userPrincipal);
      };
    };
  };
