type Environment = Record<string, string | undefined>;

const requiredVariables = ['GRAPHQL_API_URL', 'GRAPHQL_API_TOKEN'] as const;

export function validateEnv(config: Environment) {
  const missingVariables = requiredVariables.filter((key) => !config[key]);

  if (missingVariables.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`);
  }

  return config;
}
