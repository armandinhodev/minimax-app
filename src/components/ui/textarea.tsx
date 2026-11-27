"use client";

import { Textarea as ChakraTextarea } from "@chakra-ui/react";

function Textarea({ className, ...props }: React.ComponentProps<typeof ChakraTextarea>) {
  return (
    <ChakraTextarea
      className={className}
      minHeight="4rem"
      px="0.7rem"
      py="0.55rem"
      borderRadius="md"
      border="1px solid"
      borderColor="surface.rule"
      bg="surface.plate"
      fontSize="body"
      lineHeight="body"
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

export { Textarea };
