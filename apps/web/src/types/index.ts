export type Lang = "en" | "hy" | "ru";

export interface ITranslation {
  lang: Lang;
  value: string;
}

export type DeliveryMethod = "DELIVERY" | "TAKEAWAY";
export type PaymentType = "CASH";


export interface DishAdditionDto {
  id: number;
  nameEn: string;
  nameHy: string;
  nameRu: string;
  price: number;
}

export interface CreateOrderDishAdditionDto {
  additionId: number;
}

export interface OrderDishAdditionDto {
  id: number;
  nameEn: string;
  nameHy: string;
  nameRu: string;
  price: number;
}

export interface DishTagDto {
  id: number;
  nameEn: string;
  nameHy: string;
  nameRu: string;
}

export interface DishDto {
  id: number;
  nameEn: string;
  nameHy: string;
  nameRu: string;
  descriptionEn: string;
  price: number;
  url: string;
  portionEn: string;
  portionHy: string;
  portionRu: string;
  status: string;
  minimumOrderCount: number;
  priorityIndex: number;
  chefId: number;
  dishTagDto: DishTagDto;
  additions?: DishAdditionDto[];
}

export interface ExploreChefResponseDto {
  id: number;
  username: string;
  avatarUrl: string;
  bannerUrl: string;
  name: ITranslation[];
  description: ITranslation[];
  kitchen: ITranslation[];
  rating: number;
  status: string;
  phoneNumber: string;
  deliveryPrice: number;
  freeDeliveryFrom: number;
  deliveryMethods: DeliveryMethod[];
  dishes: DishDto[] | null;
}

export interface ChefsPageDto {
  exploreChefResponseDtoList: ExploreChefResponseDto[];
  count: number;
}

export interface DishPaginationCountDto {
  dishDtoList: DishDto[];
  count: number;
}

export interface ChefTagOrderWithDishTagDto {
  priorityIndex: number;
  dishTagDto: DishTagDto;
}

export interface DeliveryPriceRequest {
  chefId: number;
  subtotal: number;
  deliveryMethod: DeliveryMethod;
}

export interface DeliveryPriceResponse {
  deliveryPrice: number;
  freeDeliveryFrom: number;
}

export interface AddressDto {
  city: string;
  street: string;
  building: string;
  apartment: string;
  note: string;
}

export interface CreateOrderDishDto {
  dishId: number;
  quantity: number;
  additions?: CreateOrderDishAdditionDto[];
}

export interface OrderDto {
  chefId: number;
  receiverName: string;
  receiverPhoneNumber: string;
  receiverEmail: string;
  paymentType: PaymentType;
  deliveryMethod: DeliveryMethod;
  note: string;
  addressDto: AddressDto | null;
  createOrderDishes: CreateOrderDishDto[];
}

export interface OrderCreateResponseDto {
  number: string;
  status: string;
  totalPrice: number;
}

export interface OrderDishDto {
  id: number;
  nameEn: string;
  nameHy: string;
  nameRu: string;
  price: number;
  url: string;
  quantity: number;
  additions?: OrderDishAdditionDto[];
}

export interface CustomerProfile {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
}

export interface CustomerAuthDto {
  token: string;
  customer: CustomerProfile;
}

export interface CustomerRegisterRequest {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
}

export interface CustomerLoginRequest {
  email: string;
  password: string;
}

export interface OrderListResponseDto {
  list: FullOrderDto[];
  count: number;
}

export interface FullOrderDto {
  number: string;
  status: string;
  chefId: number;
  chefName: string;
  receiverName: string;
  receiverPhoneNumber: string;
  receiverEmail: string;
  paymentType: PaymentType;
  deliveryMethod: DeliveryMethod;
  note: string;
  addressDto: AddressDto | null;
  orderDishList: OrderDishDto[];
  totalPrice: number;
  createdAt: string;
  /** The customer's rating; null until the order has been reviewed. */
  review: OrderReviewDto | null;
}

export interface OrderReviewDto {
  stars: number;
  comment: string | null;
  createdAt: string;
}

export interface OrderReviewRequest {
  stars: number;
  comment?: string;
}

export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}

// Cart types

export interface ICartItem {
  id: number;
  uid: string;
  chefId: number;
  nameEn: string;
  price: number;
  url: string;
  quantity: number;
  additions?: DishAdditionDto[];
  limitations: {
    minQuantity: number;
  };
}
