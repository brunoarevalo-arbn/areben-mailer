import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Autorización: lo que ESCRIBE no puede pedirle la cuenta a getCuentaActiva().
    //
    // Esa función devuelve la marca pero no sabe QUIÉN está pidiendo, y como era
    // el único guard obligatorio de las actions, la app terminó sin permisos
    // reales: cualquiera con sesión podía mandarle una campaña a toda la lista.
    // Acá se corta de raíz — una action nueva que la importe no pasa el lint.
    // Para leer, las páginas la siguen usando sin problema.
    files: ["app/**/actions.ts", "app/api/**/route.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/cuenta",
              importNames: ["getCuentaActiva"],
              message:
                "Usá autorizar() / chequear() / autorizarApi() de @/lib/auth: getCuentaActiva no conoce al usuario ni su rol.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
