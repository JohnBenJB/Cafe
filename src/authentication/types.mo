module {
  public type User = {
    id : Nat;
    username : Text;
    email : Text;
    github : Text;
    slack : Text;
    principal : Principal;
    tablesCreated : [Nat];
    tablesJoined : [Nat];
  };
}