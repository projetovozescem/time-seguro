// Roda uma consulta no projeto de DESENVOLVIMENTO e imprime o resultado.
//
//   node scripts/db-sql.mjs "select 1"
//   echo "select 1" | node scripts/db-sql.mjs
//
// Serve para as evidências dos gates — mostrar a consulta e o resultado,
// inclusive as consultas que DEVEM falhar: nesse caso imprime o erro do
// Postgres e sai com código 1.
//
// As credenciais vêm do .env (fora do git), nunca da linha de comando.
import { consultar } from "./_db.mjs";

const query =
  process.argv[2] ??
  (await new Promise((ok) => {
    let s = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (s += c));
    process.stdin.on("end", () => ok(s));
  }));

if (!query.trim()) {
  console.error("Nenhuma consulta recebida.");
  process.exit(1);
}

try {
  const linhas = await consultar(query);
  if (!Array.isArray(linhas) || linhas.length === 0) {
    console.log("(nenhuma linha)");
  } else {
    console.log(JSON.stringify(linhas, null, 2));
  }
} catch (erro) {
  console.error(`ERRO ${erro.message}`);
  process.exit(1);
}
