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
import Iter "mo:base/Iter";
import Error "mo:base/Error";
import Debug "mo:base/Debug";

module {
  // ===== CORE TYPES =====
  
  // Unique identifiers
  public type ChatId = Nat32;
  public type Nat = Nat32;
  public type UserPrincipal = Principal;
  
  // ===== CHAT TYPES =====
  
  // Chat room information
  public type ChatInfo = {
    id : ChatId; //might not be a necessary field
    tableId : Nat;
    participants : [Principal];
    createdAt : Time.Time;
    lastMessageAt : Time.Time;
    isActive : Bool;
  };
  
  // Chat room with internal data
  public type Chat = {
    info : ChatInfo;
    messages : HashMap.HashMap<Nat, Message>;
    nextNat : Nat;
    participants : HashMap.HashMap<Principal, ParticipantInfo>; // Maps user IDs to participant info
  };
  
  // Participant information
  public type ParticipantInfo = {
    userPrincipal : Principal;
    joinedAt : Time.Time;
    lastSeen : Time.Time;
    isActive : Bool;
  };
  
  // ===== MESSAGE TYPES =====
  
  // Message content types
  public type MessageContent = {
    #Text : Text;
    #System : Text; // System messages like "User joined"
  };
  
  // Individual message
  public type Message = {
    id : Nat;
    chatId : ChatId;
    senderPrincipal : Principal;
    content : MessageContent;
    timestamp : Time.Time;
    isEdited : Bool;
    isDeleted : Bool;
    replyTo : ?Nat; // For reply functionality
  };
  
  // Message for API responses
  public type MessageResponse = {
    id : Nat;
    senderPrincipal : Principal;
    senderName : Text; // Resolved from user ID; mught later change or be removed
    content : MessageContent;
    timestamp : Time.Time;
    isEdited : Bool;
    isDeleted : Bool;
    replyTo : ?Nat;
  };
  
  // ===== EVENT TYPES =====
  
  // Real-time events
  public type ChatEvent = {
    #MessageSent : MessageResponse;
    #MessageEdited : { Nat : Nat; newContent : MessageContent };
    #MessageDeleted : Nat;
    #UserJoined : { userPrincipal : Principal; username : Text };
    #UserLeft : { userPrincipal : Principal; username : Text };
    #UserTyping : { userPrincipal : Principal; isTyping : Bool };
  };
  
  // ===== UTILITY TYPES =====
  
  // Paginated results
  public type Paginated<T> = {
    items : [T];
    next : ?Nat; // Offset for next page
    total : Nat;
  };
  
  // Error types
  public type Error = {
    #NotFound;
    #AccessDenied;
    #InvalidOperation;
    #ChatFull;
    #MessageTooLong;
    #UserNotInChat;
    #InternalError;
  };
  
  // Result types
  public type Result<T, E> = {
    #Ok : T;
    #Err : E;
  };
  
  // ===== CONSTANTS =====
  
  public let MAX_MESSAGE_LENGTH : Nat = 1000; // 1000 characters
  public let MAX_CHAT_PARTICIPANTS : Nat = 50; // Max 50 participants per chat
  public let MAX_MESSAGES_PER_REQUEST : Nat = 100; // Max messages per API call
  public let TYPING_TIMEOUT_NANOS : Int = 5_000_000_000; // 5 seconds
  
  // ===== HELPER FUNCTIONS =====
  
  // Get current timestamp
  public func now() : Time.Time {
    Time.now();
  };
  
  // Check if user is in chat
  public func isUserInChat(userPrincipal : Principal, participants : [Principal]) : Bool {
    for (participant in participants.vals()) {
      if (Principal.equal(userPrincipal, participant)) {
        return true;
      };
    };
    false;
  };
  
  // Validate message content
  public func validateMessageContent(content : MessageContent) : Bool {
    switch (content) {
      case (#Text(text)) {
        Text.size(text) <= Nat32.toNat(MAX_MESSAGE_LENGTH) and Text.size(text) > 0;
      };
      case (#System(text)) {
        Text.size(text) > 0;
      };
    };
  };
  
  // Format error message
  public func errorMessage(error : Error) : Text {
    switch (error) {
      case (#NotFound) { "Resource not found" };
      case (#AccessDenied) { "Access denied" };
      case (#InvalidOperation) { "Invalid operation" };
      case (#ChatFull) { "Chat is full" };
      case (#MessageTooLong) { "Message too long" };
      case (#UserNotInChat) { "User not in chat" };
      case (#InternalError) { "Internal error" };
    };
  };
  
  // Convert Principal to Text for HashMap keys
  public func principalToText(p : Principal) : Text {
    Principal.toText(p);
  };
  
  // Convert Text to Principal (with error handling)
  // public func textToPrincipal(t : Text) : Result<Principal, Error> {
  //   switch (Principal.fromText(t)) {
  //     case (?p) { #Ok(p) };
  //     case null { #Err(#InvalidOperation) };
  //   };
  // };
};
