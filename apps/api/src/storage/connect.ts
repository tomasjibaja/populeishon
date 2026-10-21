import mongoose from 'mongoose';
import { MongoScoreRepository } from './mongoRepository';

/** Conecta con MongoDB y prepara la colección y los índices. */
export async function connectMongo(uri: string, dbName: string): Promise<MongoScoreRepository> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10_000 });
  const repository = new MongoScoreRepository();
  await repository.init();
  return repository;
}
