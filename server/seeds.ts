import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import bcrypt from 'bcryptjs';
import { planos, users } from "@shared/schema";
import type { InsertPlano, InsertUser } from "@shared/schema";
import { eq } from 'drizzle-orm';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not found");
}

// SA_PASSWORD is required — no insecure default.
if (!process.env.SA_PASSWORD) {
  throw new Error(
    'SA_PASSWORD environment variable is required to bootstrap the SUPER_ADMIN account. ' +
    'Set a strong password before running seeds.'
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

const initialPlanos: InsertPlano[] = [
  { nome: "Beta Gratuito", limiteAlunos: 10,  precoMensal: 0,     ativo: true },
  { nome: "Básico",        limiteAlunos: 50,  precoMensal: 4900,  ativo: true },
  { nome: "Profissional",  limiteAlunos: 200, precoMensal: 9900,  ativo: true },
  { nome: "Enterprise",   limiteAlunos: 500, precoMensal: 19900, ativo: true },
];

const BOOTSTRAP_ADMIN = {
  email: process.env.SA_EMAIL || "superadmin@centrodelutas.com",
  password: process.env.SA_PASSWORD,
  name: "Super Administrador",
};

async function seedSuperAdmin() {
  console.log("👤 Verificando usuário SUPER_ADMIN...");

  const existingSuperAdmin = await db.select().from(users).where(eq(users.role, 'SUPER_ADMIN'));

  if (existingSuperAdmin.length > 0) {
    console.log(`⚠️  SUPER_ADMIN já existe (${existingSuperAdmin[0].email}). Pulando criação.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(BOOTSTRAP_ADMIN.password, 12);

  const superAdminUser: InsertUser = {
    email: BOOTSTRAP_ADMIN.email,
    password: hashedPassword,
    name: BOOTSTRAP_ADMIN.name,
    role: 'SUPER_ADMIN',
    academyId: null,
    active: true,
    firstAccess: false,
  };

  const [insertedUser] = await db.insert(users).values(superAdminUser).returning();

  console.log("✅ Usuário SUPER_ADMIN criado com sucesso:");
  console.log(`   • Email: ${insertedUser.email}`);
  console.log(`   • Nome: ${insertedUser.name}`);
  // Password is intentionally NOT logged.
}

async function seedPlanos() {
  console.log("🌱 Verificando planos...");

  const existingPlanos = await db.select().from(planos);

  if (existingPlanos.length > 0) {
    console.log(`⚠️  ${existingPlanos.length} planos já existem. Pulando seeding.`);
    return;
  }

  const insertedPlanos = await db.insert(planos).values(initialPlanos).returning();

  console.log("✅ Planos criados com sucesso:");
  insertedPlanos.forEach(plano => {
    const preco = plano.precoMensal === 0 ? "Gratuito" : `R$ ${(plano.precoMensal / 100).toFixed(2)}`;
    console.log(`   • ${plano.nome}: ${plano.limiteAlunos} alunos - ${preco}/mês`);
  });
}

async function seedDatabase() {
  try {
    console.log("🚀 Iniciando seeding do banco de dados...");
    await seedSuperAdmin();
    await seedPlanos();
    console.log("🎉 Seeding concluído com sucesso!");
  } catch (error) {
    console.error("💥 Seeding falhou:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedDatabase, seedPlanos, seedSuperAdmin };
