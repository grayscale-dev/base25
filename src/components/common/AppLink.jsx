"use client";

import React from "react";
import NextLink from "next/link";

const toHref = (to) => {
  if (typeof to === "string") return to;
  if (to && typeof to === "object") {
    const pathname = to.pathname ?? "";
    const search = to.search ?? "";
    const hash = to.hash ?? "";
    return `${pathname}${search}${hash}` || "#";
  }
  return "#";
};

const AppLink = React.forwardRef(({ to, ...props }, ref) => {
  const href = toHref(to);

  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
    return <a ref={ref} href={href} {...props} />;
  }

  return <NextLink ref={ref} href={href} {...props} />;
});

AppLink.displayName = "AppLink";

export default AppLink;
