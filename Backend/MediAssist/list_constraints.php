
try {
    $results = DB::select("SELECT * FROM information_schema.table_constraints WHERE table_name = 'patients'");
    foreach($results as $r) {
        echo $r->CONSTRAINT_NAME . " (" . $r->CONSTRAINT_TYPE . ")\n";
    }
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage();
}
