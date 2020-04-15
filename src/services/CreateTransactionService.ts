import { getCustomRepository, getRepository } from 'typeorm';

import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionRepository from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionRepository);
    const categoriesRepository = getRepository(Category);

    const { total } = await transactionsRepository.getBalance();

    // Checa se o usuário tem caixa suficiente
    if (type === 'outcome' && value > total) {
      throw new AppError(
        'Você não tem dinheiro em caixa sufiente para realizar esta ação',
      );
    }

    // Checa se a categoria já existe
    let categoryToAdd = await categoriesRepository.findOne({
      where: {
        title: category,
      },
    });

    // Cria uma nova, caso não exista
    if (!categoryToAdd) {
      categoryToAdd = await categoriesRepository.create({ title: category });
      await categoriesRepository.save(categoryToAdd);
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category_id: categoryToAdd.id,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
