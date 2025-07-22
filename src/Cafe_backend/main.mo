import TrieMap "mo:base/TrieMap";
import Principal "mo:base/Principal";

actor {
  // User record
  public type User = {
    username : Text;
    email : Text;
    principal : Principal;
  };

  let usersByPrincipal = TrieMap.TrieMap<Principal, User>(Principal.equal, Principal.hash);

  // Register or update user profile with Internet Identity
  public func register_or_update(username : Text, email : Text) : async Text {
    let caller = msg.caller;
    let user : User = {
      username = username;
      email = email;
      principal = caller;
    };
    usersByPrincipal.put(caller, user);
    return "Profile registered/updated.";
  };

  // Get current user profile
  public query func get_profile() : async ?User {
    usersByPrincipal.get(msg.caller)
  };
}
