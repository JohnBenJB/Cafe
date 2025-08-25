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
import Iter "mo:base/Iter";
import Error "mo:base/Error";
import Debug "mo:base/Debug";

module {
  // ===== REALTIME COLLABORATION MODULE =====
  // Handles live editing, presence, cursors, and event delivery
  
  // Import types
  public type FileId = Types.FileId;
  public type Version = Types.Version;
  public type ClientId = Types.ClientId;
  public type Seq = Types.Seq;
  public type Event = Types.Event;
  public type Cursor = Types.Cursor;
  public type PresenceEvent = Types.PresenceEvent;
  public type Subscription = Types.Subscription;
  public type Patch = Types.Patch;
  public type EditOp = Types.EditOp;
  public type Error = Types.Error;
  public type Result<T, E> = Types.Result<T, E>;
  
  // ===== INTERNAL DATA STRUCTURES =====
  
  // Ring buffer for events (bounded size)
  public type EventRingBuffer = {
    events : Buffer.Buffer<Event>;
    maxSize : Nat;
    var startSeq : Seq;
  };
  
  // Client presence information
  public type ClientPresence = {
    clientId : ClientId;
    user : Principal;
    lastSeen : Time.Time;
    cursor : ?Cursor;
  };
}; 