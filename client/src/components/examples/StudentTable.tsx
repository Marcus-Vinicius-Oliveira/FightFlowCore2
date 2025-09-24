import { StudentTable } from '../StudentTable';

export default function StudentTableExample() {
  return (
    <div className="p-8">
      <StudentTable 
        onAddStudent={() => console.log('Add student')}
        onEditStudent={(student) => console.log('Edit student:', student)}
        onViewStudent={(student) => console.log('View student:', student)}
        onDeleteStudent={(student) => console.log('Delete student:', student)}
      />
    </div>
  );
}