import { QueryClient } from "@tanstack/react-query";

/**
 * Helper function to invalidate all caches related to student changes.
 * This ensures dashboard counters and student lists are updated consistently.
 */
export function invalidateAfterStudentChange(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['/api/students'] });
  queryClient.invalidateQueries({ queryKey: ['/api/students/academy-modality-enrollments'] });
  queryClient.invalidateQueries({ queryKey: ['/api/users'] });
  queryClient.invalidateQueries({ queryKey: ['/api/instructors'] });
  queryClient.invalidateQueries({ queryKey: ['/api/dashboard/info'] });
  queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
  queryClient.invalidateQueries({ queryKey: ['/api/dashboard/charts'] });
}

/**
 * Helper function to invalidate all caches related to instructor changes.
 * This ensures dashboard counters and instructor lists are updated consistently.
 */
export function invalidateAfterInstructorChange(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['/api/instructors'] });
  queryClient.invalidateQueries({ queryKey: ['/api/users'] });
  queryClient.invalidateQueries({ queryKey: ['/api/dashboard/info'] });
}