import fs from 'fs';
const code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// The replacement logic: we find `key="missionTable"` then locate the end of `adminTab === "missions" && (`
// It's easier: replace `          )\n        )}\n\n        {adminTab === "clients" && (`
// With the personnel block wrapped in `{adminTab === "personnel" && (`

const personnelBlock = `          )
        )}

        {adminTab === "personnel" && (
          <motion.div
            key="personnelTable"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-xl shadow-navy-900/5 mb-20"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-slate-50">
                    <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400 pl-8">
                      Identity
                    </TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400">
                      Department
                    </TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400">
                      Contact Number
                    </TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400">
                      Privilege
                    </TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400">
                      Join Date
                    </TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400 text-right pr-8">
                      Management
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-20 text-xs font-black uppercase text-slate-300 tracking-widest italic"
                      >
                        No personnel found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => (
                      <TableRow
                        key={u.uid}
                        className="hover:bg-slate-50/80 transition-colors border-slate-50 group"
                      >
                        <TableCell className="pl-8">
                          <div className="flex items-center gap-3 py-2">
                            <div
                              className={"w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs " + (u.role === "admin" ? "bg-red-50 text-red-600 border border-red-100" : "bg-slate-100 text-navy-900")}
                            >
                              {u.displayName?.charAt(0)}
                            </div>
                            <div className="flex flex-col -space-y-0.5">
                              <span className="font-black text-navy-900 text-sm">
                                {u.displayName}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 lowercase">
                                {u.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="rounded-md border-slate-100 text-slate-500 font-bold text-[9px] uppercase tracking-widest"
                          >
                            {u.department}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-data font-bold text-slate-500 text-xs">
                          {u.contactNumber || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {u.role === "admin" ? (
                              <div className="flex items-center gap-1.5 text-red-600 font-black text-[10px] uppercase tracking-tighter">
                                <ShieldAlert className="h-3 w-3" />
                                Admin
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-slate-400 font-black text-[10px] uppercase tracking-tighter">
                                <Users className="h-3 w-3" />
                                User
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-data font-bold text-slate-400 text-xs">
                          {u.createdAt?.toDate().toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="h-10 w-10 rounded-xl text-slate-400 hover:text-navy-900 hover:bg-slate-100 flex items-center justify-center transition-colors">
                              <UserCog className="h-5 w-5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="rounded-2xl p-2 min-w-[200px]"
                            >
                              <div className="px-3 py-2 micro-label text-slate-300">
                                Personnel Operations
                              </div>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingUser(u);
                                  setEditName(u.displayName || "");
                                  setEditDepartment(u.department || "");
                                  setEditContact(u.contactNumber || "");
                                }}
                                className="gap-3 text-slate-700 cursor-pointer rounded-xl font-bold"
                              >
                                <UserCog className="h-4 w-4" /> Edit Profile
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-slate-100" />
                              <div className="px-3 py-2 micro-label text-slate-300">
                                Privilege Override
                              </div>
                              {u.role === "user" ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUpdateUserRole(u.uid, "admin")
                                  }
                                  className="gap-3 text-red-600 cursor-pointer rounded-xl font-bold"
                                >
                                  <Lock className="h-4 w-4" /> Promote to Admin
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUpdateUserRole(u.uid, "user")
                                  }
                                  className="gap-3 text-slate-600 cursor-pointer rounded-xl font-bold"
                                >
                                  <Unlock className="h-4 w-4" /> Demote to User
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="bg-slate-100" />
                              <DropdownMenuItem
                                onClick={() => handleDeleteUser({ uid: u.uid, email: u.email, displayName: u.displayName })}
                                className="gap-3 text-red-500 cursor-pointer rounded-xl font-bold hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" /> Purge from
                                Registry
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        )}

        {adminTab === "clients" && (`;

const tokenToReplace = "              ))}\n            </motion.div>\n          )\n        )}\n\n        {adminTab === \"clients\" && (";

let newCode = code.replace(tokenToReplace, personnelBlock);

fs.writeFileSync('src/pages/AdminDashboard.tsx', newCode);
