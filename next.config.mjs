import withPWA from "next-pwa";

const nextConfig = {
  // You can keep other Next config here
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development", // SW only in production
})(nextConfig);
