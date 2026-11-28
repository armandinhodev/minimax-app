"use client";

import { Input as ChakraInput } from "@chakra-ui/react";

function Input({ className, ...props }: React.ComponentProps<typeof ChakraInput>) {
  return (
    <ChakraInput
      className={className}
      height={{ base: "44px", md: "36px" }}
      px="10px"
      borderRadius="md"
      border="1px solid"
      borderColor="surface.rule"
      bg="surface.plate"
      fontSize="body"
      color="content.ink"
      _focus={{
        borderColor: "interaction.accent",
        boxShadow: "0 0 0 3px var(--chakra-colors-interaction-focus-ring)",
        outline: "none",
      }}
      _placeholder={{ color: "content.placeholder" }}
      _disabled={{ opacity: 1, cursor: "not-allowed", bg: "surface.field", color: "content.readout" }}
      {...props}
    />
  );
}

export { Input };
