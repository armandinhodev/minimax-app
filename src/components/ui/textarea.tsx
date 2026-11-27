"use client";

import { Textarea as ChakraTextarea } from "@chakra-ui/react";

function Textarea({ className, ...props }: React.ComponentProps<typeof ChakraTextarea>) {
  return (
    <ChakraTextarea
      className={className}
      minHeight="72px"
      px="10px"
      py="8px"
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
      _placeholder={{ color: "content.readout" }}
      _disabled={{ opacity: 1, cursor: "not-allowed", bg: "surface.field", color: "content.readout" }}
      {...props}
    />
  );
}

export { Textarea };
