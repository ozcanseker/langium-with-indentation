grammar HelloWorld

entry ModelRoot:
    parent=Parent;

Parent:
    'parent'':'
        INDENT
            (fields = PartentField)*
        DEDENT;

PartentField:
     (
        'name' ':' name=ID |
            'children' ':' INDENT ( children +=child ) DEDENT |
        'ietsanders' ':' ietsanders=ID
     )*;

child:
    'name' ':' name=ID;

terminal ID: /[_a-zA-Z][a-zA-Z]*/;

// Dedent moet voor indent komen
hidden terminal NEWLINE: 'this_string_does_not_matter_newline#$%^&*((';
terminal DEDENT: 'this_string_does_not_matter_dedent#$%^&*((';
terminal INDENT: 'this_string_does_not_matter_indent#$%^&*((';
hidden terminal SPACES: 'this_string_does_not_matter_spaces#$%^&*((';
