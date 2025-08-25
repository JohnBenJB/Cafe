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
  // ===== FILE STORAGE MODULE =====
  // Handles file creation, reading, updating, and deletion with chunked storage
  
  // Import types
  public type FileId = Types.FileId;
  public type Version = Types.Version;
  public type ContentChunk = Types.ContentChunk;
  public type FileMeta = Types.FileMeta;
  public type Access = Types.Access;
  public type Role = Types.Role;
  public type Error = Types.Error;
  public type Result<T, E> = Types.Result<T, E>;
  public type Paginated<T> = Types.Paginated<T>;
  
  // ===== INTERNAL DATA STRUCTURES =====
  
  // File storage structure
  public type FileStorage = {
    var meta : FileMeta;
    var access : Access;
    var chunks : HashMap.HashMap<Nat, ContentChunk>;
    var headVersion : Version;
    var isDeleted : Bool;
  };
};


