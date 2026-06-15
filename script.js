import fs from 'fs';
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const startStr = `              ))}
            </motion.div>
          )
        ) : (
          <motion.div
            key="personnelTable"`;
const endStr = `            </div>
          </motion.div>
        )}

        {adminTab === "clients" && (`;

const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `              ))}
            </motion.div>
          )
        )}

        {adminTab === "clients" && (`;
  
  const toReplace = code.substring(startIdx, endIdx + endStr.length);
  code = code.replace(toReplace, replacement);
  fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
  console.log("Success replacing block");
} else {
  console.log("Failed to find indices", startIdx, endIdx);
}
