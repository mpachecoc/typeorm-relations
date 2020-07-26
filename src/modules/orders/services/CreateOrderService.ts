import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer ID was not found');
    }

    // Create "Products"[] adding price
    const productIds = Object.values(products).map(product => ({
      id: product.id,
    }));

    const productsFromDB = await this.productsRepository.findAllById(
      productIds,
    );

    if (products.length !== productsFromDB.length) {
      throw new AppError('Some Product Id was not found');
    }

    const productsWithPrice = products.map(product => {
      const DBProduct = productsFromDB.find(prod => prod.id === product.id);

      if (!DBProduct) {
        throw new AppError('Some Product Id was not found');
      }

      if (product.quantity > DBProduct.quantity) {
        throw new AppError(
          `There are not enough items (${DBProduct.name}) in stock`,
        );
      }

      const { price } = DBProduct;

      return {
        product_id: product.id,
        quantity: product.quantity,
        price,
      };
    });

    // Create
    const order = await this.ordersRepository.create({
      customer,
      products: productsWithPrice,
    });

    // Update Product Qtys
    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateOrderService;
