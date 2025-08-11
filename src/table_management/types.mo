module {
  public type Table = {
    id : Nat;
    title : Text;
    creator : Principal;
    description : Text;
    tableCollaborators : [Principal]; // List of users in Table
  };

  // Return type for user tables
  public type UserTables = {
    created: [Table]; 
    joined: [Table];
  };
}