"use client";

import { Input as ChakraInput } from "@chakra-ui/react";

function Input({ className, ...props }: React.ComponentProps<typeof ChakraInput>) {
  return (
    <ChakraInput
      className={className}
      height="2.25rem"
      px="0.625rem"
      borderRadius="md"
      border="1px solid"
      borderColor="surface.rule"
      bg="surface.sheet"
      fontSize="body"
      color="content.ink"
      _focus={{
        borderColor: "interaction.accent",
        boxShadow: "0 0 0 3px var(--chakra-colors-interaction-focus-ring)",
        outline: "none",
      }}
      _placeholder={{ color: "content.subtle" }}
      _disabled={{ opacity: 1, cursor: "not-allowed", bg: "surface.field", color: "content.subtle" }}
      {...props}
    />
  );
}

export { Input };
