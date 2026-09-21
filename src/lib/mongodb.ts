import { MongoClient, MongoClientOptions, Db } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/moneytrack";
const dbName = process.env.MONGODB_DB || "moneytrack";

const isAtlas = uri.includes(".mongodb.net");

const options: MongoClientOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  ...(isAtlas
    ? {
        tls: true,
        tlsAllowInvalidCertificates: true, // Fixes Node.js OpenSSL ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR (SSL alert 80)
      }
    : {}),
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}

export default clientPromise;
