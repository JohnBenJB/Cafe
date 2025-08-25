module {
  public type User = {
    principal : Text;
    username : Text;
    email : Text;
    github : Text;
    slack : Text;
    tablesCreated : [Nat];
    tablesJoined : [Nat];
    identityProvider : Text;
    lastLogin : Int;
    isVerified : Bool;
    hasCompletedSetup : Bool; // Track if user has completed profile setup
  };

  public type AuthResult = {
    success : Bool;
    message : ?Text;
    user : ?User;
  };

  public type LoginRequest = {
    principal : Text;
    identityProvider : Text;
  };

  public type ProfileUpdateRequest = {
    username : Text;
    email : Text;
    github : Text;
    slack : Text;
  };
  public type Session = {
    sessionId : Text;
    principal : Text;
    createdAt : Int;
    expiresAt : Int;
  };

  public type SessionResult = {
    success : Bool;
    message : ?Text;
    session : ?Session;
  };
};