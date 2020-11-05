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
      throw new AppError('Customer not found.');
    }

    const currentProducts = await this.productsRepository.findAllById(products);

    const productsWithPrice = products.map(product => {
      const productInDB = currentProducts.find(
        currentProduct => currentProduct.id === product.id,
      );

      if (!productInDB)
        throw new AppError(`Could not find product with id ${product.id}.`);

      if (product.quantity > productInDB.quantity) {
        throw new AppError(
          `There is only ${productInDB.quantity} units of ${product.id} available.`,
        );
      }

      return {
        product_id: product.id,
        price: productInDB.price,
        quantity: product.quantity,
        quantity_left: productInDB.quantity - product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: productsWithPrice,
    });

    const productsWithUpdatedQuantity = productsWithPrice.map(product => ({
      id: product.product_id,
      quantity: product.quantity_left,
    }));

    await this.productsRepository.updateQuantity(productsWithUpdatedQuantity);

    return order;
  }
}

export default CreateOrderService;
