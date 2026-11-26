"use client";

import { Box, Button, Text } from "@chakra-ui/react";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minH="50vh"
      gap={4}
      p={8}
      textAlign="center"
    >
      <Text fontSize="xl" fontWeight="bold" color="state.err">
        Something went wrong
      </Text>
      <Text color="content.readout" fontSize="sm" maxW="md">
        An unexpected error occurred.
      </Text>
      {error.digest && (
        <Text color="content.subtle" fontSize="xs">
          Error ID: {error.digest}
        </Text>
      )}
      <Button
        onClick={reset}
        mt={2}
        size="sm"
        variant="outline"
      >
        Try again
      </Button>
    </Box>
  );
}
