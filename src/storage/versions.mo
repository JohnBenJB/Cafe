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
  // ===== VERSIONING MODULE =====
  // Handles file version history, commits, snapshots, and rollback functionality
  
  // Import types
  public type FileId = Types.FileId;
  public type Version = Types.Version;
  public type ContentChunk = Types.ContentChunk;
  public type Commit = Types.Commit;
  public type Patch = Types.Patch;
  public type EditOp = Types.EditOp;
  public type Error = Types.Error;
  public type Result<T, E> = Types.Result<T, E>;
  public type Paginated<T> = Types.Paginated<T>;
  
  // ===== INTERNAL DATA STRUCTURES =====
  
  // Version storage structure
  public type VersionStorage = {
    commit : Commit;
    chunks : HashMap.HashMap<Nat, ContentChunk>; // Snapshot of chunks at this version
  };
};




