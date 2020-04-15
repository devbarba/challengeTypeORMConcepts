import { getRepository, getCustomRepository, getConnection } from 'typeorm';
import parseCSV from 'csv-parse';
import path from 'path';
import fs from 'fs';

import uploadConfig from '../config/upload';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  filename: string;
}

interface TransactionTmp {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute({ filename }: Request): Promise<Transaction[]> {
    const lines = parseCSV({ from_line: 2, delimiter: ', ' });

    const filePath = path.join(uploadConfig.directory, filename);
    const readStream = fs.createReadStream(filePath);

    const parsedCSV = readStream.pipe(lines);

    const transactionsTmp: TransactionTmp[] = [];
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    parsedCSV.on('data', async line => {
      const [title, type, value, category] = line;

      transactionsTmp.push({ title, type, value, category });
    });

    await new Promise(resolve => parsedCSV.on('end', resolve));

    const categories = transactionsTmp
      .map(transactionTmp => transactionTmp.category)
      .filter((element, position, thisArray) => {
        return thisArray.indexOf(element) === position;
      })
      .map(category => categoriesRepository.create({ title: category }));

    await getConnection()
      .createQueryBuilder()
      .insert()
      .into(Category)
      .values(categories)
      .execute();

    const transactions = transactionsTmp.map(transaction => {
      const category_id = categories.find(
        category => category.title === transaction.category,
      )?.id;

      const { title, type, value } = transaction;

      return transactionsRepository.create({
        title,
        type,
        value,
        category_id,
      });
    });

    await getConnection()
      .createQueryBuilder()
      .insert()
      .into(Transaction)
      .values(transactions)
      .execute();

    fs.promises.unlink(filePath);

    return transactions;
  }
}

export default ImportTransactionsService;
