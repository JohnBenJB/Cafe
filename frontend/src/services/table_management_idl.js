export const idlFactory = ({ IDL }) => {
  const Table = IDL.Record({
    id: IDL.Nat,
    title: IDL.Text,
    creator: IDL.Principal,
    description: IDL.Text,
    tableCollaborators: IDL.Vec(IDL.Principal),
  });

  const UserTables = IDL.Record({
    created: IDL.Vec(Table),
    joined: IDL.Vec(Table),
  });

  const TableResult = IDL.Variant({
    ok: Table,
    err: IDL.Text,
  });

  const UserTablesResult = IDL.Variant({
    ok: UserTables,
    err: IDL.Text,
  });

  const TextResult = IDL.Variant({
    ok: IDL.Text,
    err: IDL.Text,
  });

  const NatArrayResult = IDL.Variant({
    ok: IDL.Vec(IDL.Nat),
    err: IDL.Text,
  });

  const TextArrayResult = IDL.Variant({
    ok: IDL.Vec(IDL.Text),
    err: IDL.Text,
  });

  // User type aligned with authentication canister's User
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

  const UserArrayResult = IDL.Variant({
    ok: IDL.Vec(User),
    err: IDL.Text,
  });

  const TableArrayResult = IDL.Variant({
    ok: IDL.Vec(Table),
    err: IDL.Text,
  });

  return IDL.Service({
    create_table: IDL.Func([IDL.Text, IDL.Text, IDL.Text], [TableResult], []),
    delete_table: IDL.Func([IDL.Text, IDL.Nat], [TableResult], []),
    get_table: IDL.Func([IDL.Nat], [IDL.Opt(Table)], ["query"]),
    get_user_tables: IDL.Func([IDL.Text], [UserTablesResult], []),
    leave_table: IDL.Func([IDL.Text, IDL.Nat], [NatArrayResult], []),
    get_table_collaborators: IDL.Func([IDL.Nat], [UserArrayResult], []),
    request_join_table: IDL.Func(
      [IDL.Text, IDL.Principal, IDL.Nat],
      [TextResult],
      []
    ),
    accept_join_table: IDL.Func([IDL.Text, IDL.Nat], [NatArrayResult], []),
    reject_join_request: IDL.Func([IDL.Text, IDL.Nat], [TextResult], []),
    cancel_join_request: IDL.Func(
      [IDL.Text, IDL.Principal, IDL.Nat],
      [TextResult],
      []
    ),
    get_pending_sent_requests: IDL.Func(
      [IDL.Text, IDL.Nat],
      [TextArrayResult],
      []
    ),
    get_pending_recieved_requests: IDL.Func([IDL.Text], [NatArrayResult], []),
    get_all_tables: IDL.Func([], [TableArrayResult], ["query"]),
  });
};
