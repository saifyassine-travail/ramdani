
try {
    $results = DB::select("SELECT conname, contype FROM pg_constraint WHERE conrelid = 'patients'::regclass");
    foreach($results as $r) {
        echo "Constraint: " . $r->conname . " (" . $r->contype . ")\n";
    }
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage();
}
