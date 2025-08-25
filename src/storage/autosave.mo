import Types "./types";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Bool "mo:base/Bool";

module {
  // ===== AUTOSAVE MODULE =====
  // Handles automatic saving, idle detection, and cleanup policies

  public type FileId = Types.FileId;
  public type Version = Types.Version;
  public type AutosavePolicy = Types.AutosavePolicy;
  public type Error = Types.Error;
  public type Result<T, E> = Types.Result<T, E>;
  
  // ===== INTERNAL DATA STRUCTURES =====
  
  // Autosave state for a file
  public type AutosaveState = {
    policy : AutosavePolicy;
    lastActivity : Time.Time;
    lastAutosave : Time.Time;
    pendingChanges : Bool;
    autosaveCount : Nat;
  };
  
  // Autosave task for processing
  public type AutosaveTask = {
    fileId : FileId;
    priority : Nat; // Higher number = higher priority
    lastActivity : Time.Time;
  };
}