// Authentication canister IDL
// Mirrors src/authentication/types.mo and main.mo
export const idlFactory = ({ IDL }) => {
  const User = IDL.Record({
    principal: IDL.Text,
    username: IDL.Text,
    email: IDL.Text,
    github: IDL.Text,
    slack: IDL.Text,
    tablesCreated: IDL.Vec(IDL.Nat),
    tablesJoined: IDL.Vec(IDL.Nat),
    identityProvider: IDL.Text,
    lastLogin: IDL.Int,
    isVerified: IDL.Bool,
    hasCompletedSetup: IDL.Bool,
  });

  const AuthResult = IDL.Record({
    success: IDL.Bool,
    message: IDL.Opt(IDL.Text),
    user: IDL.Opt(User),
  });

  const ProfileUpdateRequest = IDL.Record({
    username: IDL.Text,
    email: IDL.Text,
    github: IDL.Text,
    slack: IDL.Text,
  });

  return IDL.Service({
    register_or_update: IDL.Func(
      [IDL.Text, ProfileUpdateRequest],
      [AuthResult],
      []
    ),
    update_user_add_table: IDL.Func([IDL.Text, IDL.Nat], [AuthResult], []),
    update_user_remove_table: IDL.Func([IDL.Text, IDL.Nat], [AuthResult], []),
    get_all_users: IDL.Func([], [IDL.Vec(User)], ["query"]),
    get_user_by_principal: IDL.Func([IDL.Text], [AuthResult], ["query"]),
  });
};
