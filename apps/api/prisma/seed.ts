import { PrismaClient, ProductStatus, Role } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_SEED !== "true"
  ) {
    throw new Error(
      "Từ chối nạp dữ liệu demo trong production. Chỉ bật ALLOW_DEMO_SEED=true khi đã xác nhận rõ ràng.",
    );
  }
  const seedDemoAccounts = process.env.SEED_DEMO_ACCOUNTS !== "false";
  if (seedDemoAccounts) {
    const adminPassword = process.env.DEMO_ADMIN_PASSWORD ?? "Admin@12345";
    const customerPassword =
      process.env.DEMO_CUSTOMER_PASSWORD ?? "Customer@12345";
    if (
      process.env.NODE_ENV === "production" &&
      (!process.env.DEMO_ADMIN_PASSWORD || !process.env.DEMO_CUSTOMER_PASSWORD)
    ) {
      throw new Error(
        "Production demo accounts yêu cầu mật khẩu được cấp qua environment.",
      );
    }
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    const customerPasswordHash = await argon2.hash(customerPassword, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    await prisma.user.upsert({
      where: { email: "admin@securecommerce.local" },
      update: { name: "Quản trị viên", role: Role.ADMIN, status: "ACTIVE" },
      create: {
        email: "admin@securecommerce.local",
        name: "Quản trị viên",
        passwordHash,
        role: Role.ADMIN,
      },
    });

    await prisma.user.upsert({
      where: { email: "customer@securecommerce.local" },
      update: { name: "Khách hàng Demo", status: "ACTIVE" },
      create: {
        email: "customer@securecommerce.local",
        phone: "0900000001",
        name: "Khách hàng Demo",
        passwordHash: customerPasswordHash,
        role: Role.CUSTOMER,
      },
    });
  }

  const [audio, mobile, accessories] = await Promise.all([
    prisma.category.upsert({
      where: { slug: "am-thanh" },
      update: { name: "Âm thanh", active: true },
      create: { slug: "am-thanh", name: "Âm thanh", position: 1 },
    }),
    prisma.category.upsert({
      where: { slug: "dien-thoai" },
      update: { name: "Điện thoại", active: true },
      create: { slug: "dien-thoai", name: "Điện thoại", position: 2 },
    }),
    prisma.category.upsert({
      where: { slug: "phu-kien" },
      update: { name: "Phụ kiện", active: true },
      create: { slug: "phu-kien", name: "Phụ kiện", position: 3 },
    }),
  ]);

  const [aurora, nova, orbit] = await Promise.all([
    prisma.brand.upsert({
      where: { slug: "aurora" },
      update: { name: "Aurora", active: true },
      create: { slug: "aurora", name: "Aurora" },
    }),
    prisma.brand.upsert({
      where: { slug: "nova" },
      update: { name: "Nova", active: true },
      create: { slug: "nova", name: "Nova" },
    }),
    prisma.brand.upsert({
      where: { slug: "orbit" },
      update: { name: "Orbit", active: true },
      create: { slug: "orbit", name: "Orbit" },
    }),
  ]);

  const products = [
    {
      slug: "tai-nghe-aurora-pro",
      skuBase: "AUR-HP-PRO",
      name: "Tai nghe Aurora Pro",
      shortDescription:
        "Tai nghe chống ồn chủ động, pin 40 giờ và âm thanh không gian.",
      description:
        "Aurora Pro được thiết kế cho làm việc và di chuyển hằng ngày. Sản phẩm hỗ trợ chống ồn chủ động, chế độ xuyên âm, kết nối đa điểm và sạc nhanh USB-C.",
      basePrice: 2_490_000,
      compareAtPrice: 2_990_000,
      categoryId: audio.id,
      brandId: aurora.id,
      image: "/products/headphones.svg",
      variants: [
        {
          sku: "AUR-HP-PRO-BLK",
          name: "Đen",
          attributes: { color: "Đen" },
          price: 2_490_000,
          stock: 24,
        },
        {
          sku: "AUR-HP-PRO-WHT",
          name: "Trắng",
          attributes: { color: "Trắng" },
          price: 2_490_000,
          stock: 12,
        },
      ],
    },
    {
      slug: "dien-thoai-nova-x1",
      skuBase: "NOVA-X1",
      name: "Nova X1 5G",
      shortDescription: "Màn hình OLED 120 Hz, camera 50 MP và sạc nhanh 80 W.",
      description:
        "Nova X1 cân bằng giữa hiệu năng, camera và thời lượng pin. Máy có khung nhôm, màn hình OLED độ sáng cao và chính sách cập nhật bảo mật dài hạn.",
      basePrice: 12_990_000,
      compareAtPrice: 13_990_000,
      categoryId: mobile.id,
      brandId: nova.id,
      image: "/products/phone.svg",
      variants: [
        {
          sku: "NOVA-X1-256-BLK",
          name: "256 GB · Đen",
          attributes: { storage: "256 GB", color: "Đen" },
          price: 12_990_000,
          stock: 9,
        },
        {
          sku: "NOVA-X1-512-BLU",
          name: "512 GB · Xanh",
          attributes: { storage: "512 GB", color: "Xanh" },
          price: 14_490_000,
          stock: 6,
        },
      ],
    },
    {
      slug: "ban-phim-orbit-75",
      skuBase: "ORB-KB-75",
      name: "Bàn phím cơ Orbit 75",
      shortDescription:
        "Layout 75%, hot-swap, kết nối ba chế độ và keycap PBT.",
      description:
        "Orbit 75 phù hợp cho cả làm việc lẫn chơi game. Bàn phím hỗ trợ USB-C, Bluetooth, 2.4 GHz và cho phép thay switch không cần hàn.",
      basePrice: 1_790_000,
      compareAtPrice: null,
      categoryId: accessories.id,
      brandId: orbit.id,
      image: "/products/keyboard.svg",
      variants: [
        {
          sku: "ORB-KB-75-LIN",
          name: "Linear switch",
          attributes: { switch: "Linear", color: "Xám" },
          price: 1_790_000,
          stock: 18,
        },
        {
          sku: "ORB-KB-75-TAC",
          name: "Tactile switch",
          attributes: { switch: "Tactile", color: "Xám" },
          price: 1_890_000,
          stock: 14,
        },
      ],
    },
    {
      slug: "sac-nhanh-orbit-gan-65w",
      skuBase: "ORB-GAN-65",
      name: "Sạc nhanh Orbit GaN 65 W",
      shortDescription: "Hai cổng USB-C, một cổng USB-A, thiết kế nhỏ gọn.",
      description:
        "Củ sạc GaN hỗ trợ Power Delivery và nhiều cấu hình công suất, phù hợp cho điện thoại, máy tính bảng và laptop mỏng nhẹ.",
      basePrice: 690_000,
      compareAtPrice: 790_000,
      categoryId: accessories.id,
      brandId: orbit.id,
      image: "/products/charger.svg",
      variants: [
        {
          sku: "ORB-GAN-65-WHT",
          name: "Trắng",
          attributes: { color: "Trắng" },
          price: 690_000,
          stock: 40,
        },
      ],
    },
  ] as const;

  for (const productInput of products) {
    const existing = await prisma.product.findUnique({
      where: { slug: productInput.slug },
    });
    if (existing) continue;
    await prisma.product.create({
      data: {
        slug: productInput.slug,
        skuBase: productInput.skuBase,
        name: productInput.name,
        shortDescription: productInput.shortDescription,
        description: productInput.description,
        basePrice: productInput.basePrice,
        compareAtPrice: productInput.compareAtPrice,
        categoryId: productInput.categoryId,
        brandId: productInput.brandId,
        status: ProductStatus.ACTIVE,
        featured: true,
        images: {
          create: [
            { url: productInput.image, alt: productInput.name, position: 0 },
          ],
        },
        variants: {
          create: productInput.variants.map((variant) => ({
            sku: variant.sku,
            name: variant.name,
            attributes: variant.attributes,
            price: variant.price,
            compareAtPrice: productInput.compareAtPrice,
            stock: variant.stock,
            lowStockThreshold: 5,
            active: true,
          })),
        },
      },
    });
  }

  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    update: { active: true, startsAt: now, expiresAt: oneYearLater },
    create: {
      code: "WELCOME10",
      name: "Chào mừng khách hàng mới",
      type: "PERCENTAGE",
      value: 10,
      minOrder: 500_000,
      maxDiscount: 200_000,
      usageLimit: 1_000,
      usagePerUser: 1,
      startsAt: now,
      expiresAt: oneYearLater,
    },
  });

  const contentPages = [
    ["chinh-sach-giao-hang", "Chính sách giao hàng"],
    ["chinh-sach-doi-tra", "Chính sách đổi trả"],
    ["chinh-sach-bao-mat", "Chính sách bảo mật"],
    ["dieu-khoan-su-dung", "Điều khoản sử dụng"],
  ] as const;
  for (const [slug, title] of contentPages) {
    await prisma.contentPage.upsert({
      where: { slug },
      update: { title, published: true },
      create: {
        slug,
        title,
        content: `${title} được cấu hình trong hệ thống quản trị nội dung. Nội dung mẫu cần được rà soát pháp lý trước khi vận hành thương mại.`,
      },
    });
  }

  console.log("Seed hoàn tất.");
  if (seedDemoAccounts) {
    console.log("Đã nạp tài khoản demo; mật khẩu không được ghi ra log.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
